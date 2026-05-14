const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { bookingSchema } = require('../utils/validators');
const { generateBookingQR } = require('../utils/generateQR');
const { sendTicketEmail } = require('../services/emailService');
const { sendBookingSMS } = require('../services/smsService');
const { v4: uuidv4 } = require('uuid');

// Rules/exceptions shared across endpoints
function isBeachEquipmentCategory(category) {
  return category === 'beach_equipment';
}


const router = express.Router();

// Create booking (pending payment)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { facility_id, booking_date, time_slot, quantity, promo_code } = value;
    const user_id = req.user.id;

    // Check availability
    const availResult = await query(
      `SELECT available, is_blocked FROM availability
       WHERE facility_id = ? AND date = ? AND time_slot = ?`,
      [facility_id, booking_date, time_slot]
    );

    if (availResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No availability record found for this date and time.' });
    }

    const avail = availResult.rows[0];
    if (avail.is_blocked) {
      return res.status(400).json({ success: false, message: 'This date/time is blocked for maintenance or a private event.' });
    }
    if (avail.available < quantity) {
      return res.status(400).json({ success: false, message: `Only ${avail.available} units available.` });
    }

    // Get facility pricing metadata
    const facResult = await query(
      `SELECT 
        base_price,
        category,
        size,
        price_day_min,
        price_day_max,
        night_add_threshold_pax,
        night_add_value,
        night_add_value_high,
        hourly_rate,
        daily_rate,
        allow_time_slots,
        type,
        name
       FROM facilities WHERE id = ?`,
      [facility_id]
    );
    if (facResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facility not found.' });
    }

    const fac = facResult.rows[0];

    // Pricing rules:
    // - room_cabana/cottage: day-range uses MAX (price_day_max) and night add-on adds based on pax quantity.
    //   NOTE: booking UI currently doesn't send a 'is_night' flag; we treat night add-on as 0 unless time_slot implies night.
    //   For now: if time_slot starts with '20:' then treat as night. If you add an explicit night flag later, wire it here.
    // - beach_equipment: hourly_rate if time_slot is hour-based else daily_rate.
    //   Current system uses fixed time_slot strings; we map any slot to hourly for simplicity.

    // Enforcement: beach equipment cannot be rented on pick hours
    // (best-effort heuristic since time_slot is currently a fixed label set)
    // Common “pick” periods in legacy UIs are typically early morning slots.
    // Adjust this regex/mapping if your actual slot labels differ.
    if (isBeachEquipmentCategory(fac.category)) {
      const isPickHour = /(06:00|07:00|08:00|09:00|10:00|11:00|pick|morning)/i.test(time_slot);
      if (isPickHour) {
        return res.status(400).json({
          success: false,
          message: 'Beach equipment cannot be rented on pick hours. Please choose a different time slot.',
        });
      }
    }






    let total_amount = 0;


    if (isBeachEquipmentCategory(fac.category)) {

      // Interpret each available time_slot as a 1-hour block group for pricing purposes.
      // If you want exact hour counting, update availability model.
      const hourly = Number(fac.hourly_rate) || 0;
      const daily = Number(fac.daily_rate) || 0;
      // if slot label contains a full-day indicator, use daily; otherwise hourly
      const usesDaily = /day|full/i.test(time_slot);
      const unitPrice = usesDaily ? daily : hourly;
      total_amount = unitPrice * quantity;
    } else {

      // cottages/rooms: day price max is used
      const dayUnitPrice = Number(fac.price_day_max) || Number(fac.price_day_min) || Number(fac.base_price) || 0;

      // Determine night: heuristic based on time_slot ending
      const isNight = /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(time_slot) ? time_slot.startsWith('16') || time_slot.startsWith('18') || time_slot.startsWith('20') : false;

      const nightThreshold = Number(fac.night_add_threshold_pax) || 6;
      const nightLowAdd = Number(fac.night_add_value) || 0;
      const nightHighAdd = Number(fac.night_add_value_high) || 0;

      const nightAdd = isNight ? (quantity <= nightThreshold ? nightLowAdd : nightHighAdd) : 0;

      // quantity represents pax count for rooms/cottages
      total_amount = dayUnitPrice * quantity + nightAdd;
    };

    // Apply promo if provided
    let promo_id = null;
    if (promo_code) {
      const promoResult = await query(
        `SELECT * FROM promos WHERE code = ? AND is_active = true
         AND valid_from <= CURDATE() AND valid_until >= CURDATE()`,
        [promo_code]
      );
      if (promoResult.rows.length > 0) {
        const promo = promoResult.rows[0];
        const applicableTypes = promo.applicable_facility_types ? JSON.parse(promo.applicable_facility_types) : null;
        const applicable = !applicableTypes || applicableTypes.includes(facResult.rows[0].type);
        if (applicable) {
          promo_id = promo.id;
          if (promo.discount_type === 'percentage') {
            total_amount = total_amount * (1 - promo.discount_value / 100);
          } else {
            total_amount = Math.max(0, total_amount - promo.discount_value);
          }
        }
      }
    }

    total_amount = Math.round(total_amount * 100) / 100;

    // Create booking
    const bookingId = uuidv4();
    await query(
      `INSERT INTO bookings (id, user_id, facility_id, promo_id, booking_date, time_slot, quantity, total_amount, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [bookingId, user_id, facility_id, promo_id, booking_date, time_slot, quantity, total_amount]
    );

    const bookingResult = await query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    const booking = bookingResult.rows[0];

    // Decrease availability (hold the slot)
    await query(
      `UPDATE availability SET available = available - ?
       WHERE facility_id = ? AND date = ? AND time_slot = ?`,
      [quantity, facility_id, booking_date, time_slot]
    );

    res.status(201).json({
      success: true,
      message: 'Booking created. Please complete payment.',
      data: booking,
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to create booking.' });
  }
});

// Get my bookings
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, f.name as facility_name, f.type as facility_type, r.name as resort_name
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN resorts r ON f.resort_id = r.id
       WHERE b.user_id = ? ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('My bookings error:', err);
    res.status(500).json({ success: false, message: 'Failed to load bookings.' });
  }
});

// Get unavailable dates for date picker (based on availability.is_blocked)
// Frontend expects: array of YYYY-MM-DD strings
router.get('/unavailable-dates', async (req, res) => {
  try {
    const { facility_id } = req.query;
    if (!facility_id) {
      return res.status(400).json({ success: false, message: 'facility_id is required.' });
    }

    const result = await query(
      `SELECT DISTINCT date
       FROM availability
       WHERE facility_id = ? AND is_blocked = true
       ORDER BY date DESC`,
      [facility_id]
    );

    const dates = result.rows.map(r => r.date);
    res.json({ success: true, data: dates });
  } catch (err) {
    console.error('Unavailable dates error:', err);
    res.status(500).json({ success: false, message: 'Failed to load unavailable dates.' });
  }
});

// Get single booking
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT b.*, f.name as facility_name, f.type as facility_type, r.name as resort_name
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN resorts r ON f.resort_id = r.id
       WHERE b.id = ? AND b.user_id = ?`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to load booking.' });
  }
});

// Cancel booking (refund availability if not paid)
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const bookingResult = await query(
      `SELECT * FROM bookings WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
    }

    // Restore availability
    await query(
      `UPDATE availability SET available = available + ?
       WHERE facility_id = ? AND date = ? AND time_slot = ?`,
      [booking.quantity, booking.facility_id, booking.booking_date, booking.time_slot]
    );

    await query(
      `UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Booking cancelled successfully.' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel booking.' });
  }
});

module.exports = router;


