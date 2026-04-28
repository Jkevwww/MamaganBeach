const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { bookingSchema } = require('../utils/validators');
const { generateBookingQR } = require('../utils/generateQR');
const { sendTicketEmail } = require('../services/emailService');
const { sendBookingSMS } = require('../services/smsService');
const { v4: uuidv4 } = require('uuid');

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

    // Get facility price
    const facResult = await query('SELECT base_price, name, type FROM facilities WHERE id = ?', [facility_id]);
    if (facResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facility not found.' });
    }

    let total_amount = facResult.rows[0].base_price * quantity;

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

