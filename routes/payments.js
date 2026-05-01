const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { paymentIntentSchema } = require('../utils/validators');
const paymongoService = require('../services/paymongoService');
const { generateBookingQR } = require('../utils/generateQR');
const { sendTicketEmail } = require('../services/emailService');
const { sendBookingSMS } = require('../services/smsService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const router = express.Router();

// Create PayMongo payment intent
router.post('/create-intent', authenticateToken, async (req, res) => {
  try {
    const { error, value } = paymentIntentSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { booking_id, payment_method } = req.body;
    const user_id = req.user.id;

    // Verify booking ownership and status
    const bookingResult = await query(
      `SELECT b.*, f.name as facility_name, u.email, u.full_name, u.phone
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN users u ON b.user_id = u.id
       WHERE b.id = ? AND b.user_id = ?`,
      [booking_id, user_id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking is already paid.' });
    }

    // Create PayMongo intent
    const intent = await paymongoService.createPaymentIntent(
      booking.total_amount,
      `Booking #${booking.id} - ${booking.facility_name}`,
      { booking_id: booking.id, user_id }
    );

    // Store payment record
    const paymentId = uuidv4();
    await query(
      `INSERT INTO payments (id, booking_id, paymongo_intent_id, amount, payment_method, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [paymentId, booking_id, intent.id, booking.total_amount, payment_method]
    );

    res.json({
      success: true,
      data: {
        client_key: intent.attributes.client_key,
        intent_id: intent.id,
        amount: booking.total_amount,
        payment_method,
      },
    });
  } catch (err) {
    console.error('Create payment intent error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment intent.' });
  }
});

// PayMongo webhook
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body.data;
    if (!event) return res.status(400).send('Invalid payload');

    const eventType = event.attributes.type;

    if (eventType === 'payment.paid') {
      const paymentIntentId = event.attributes.data.attributes.payment_intent_id;
      const amount = event.attributes.data.attributes.amount / 100;

      const paymentResult = await query(
        `SELECT p.*, b.user_id, b.facility_id, b.booking_date, b.time_slot, b.quantity, b.total_amount
         FROM payments p
         JOIN bookings b ON p.booking_id = b.id
         WHERE p.paymongo_intent_id = ?`,
        [paymentIntentId]
      );

      if (paymentResult.rows.length > 0) {
        const payment = paymentResult.rows[0];

        // Update payment status
        await query(
          `UPDATE payments SET status = 'succeeded', paid_at = NOW(), webhook_data = ? WHERE id = ?`,
          [JSON.stringify(req.body), payment.id]
        );

        // Update booking status
        await query(
          `UPDATE bookings SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = ?`,
          [payment.booking_id]
        );

        // Generate QR code
        const qrDataUrl = await generateBookingQR(payment.booking_id);
        await query(`UPDATE bookings SET qr_code = ? WHERE id = ?`, [qrDataUrl, payment.booking_id]);

        // Get user info for notifications
        const userResult = await query('SELECT * FROM users WHERE id = ?', [payment.user_id]);
        const user = userResult.rows[0];
        const facilityResult = await query('SELECT name FROM facilities WHERE id = ?', [payment.facility_id]);
        const facilityName = facilityResult.rows[0]?.name || 'Facility';

        // Send email ticket
        if (user?.email) {
          await sendTicketEmail(user.email, {
            booking_id: payment.booking_id,
            full_name: user.full_name,
            facility_name: facilityName,
            booking_date: payment.booking_date,
            time_slot: payment.time_slot,
            total_amount: payment.total_amount,
            qr_code: qrDataUrl,
          });
        }

        // Send SMS
        if (user?.phone) {
          await sendBookingSMS(user.phone, {
            full_name: user.full_name,
            facility_name: facilityName,
            booking_date: payment.booking_date,
            time_slot: payment.time_slot,
            total_amount: payment.total_amount,
            booking_id: payment.booking_id,
          });
        }
      }
    }

    res.status(200).send('Webhook received');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).send('Webhook processed with error');
  }
});

// Simulate payment success (for testing without real PayMongo)
router.post('/simulate-success', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.body;
    const user_id = req.user.id;

    const bookingResult = await query(
      `SELECT b.*, f.name as facility_name, u.email, u.full_name, u.phone
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN users u ON b.user_id = u.id
       WHERE b.id = ? AND b.user_id = ?`,
      [booking_id, user_id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking is already paid.' });
    }

    await query(
      `UPDATE bookings SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = ?`,
      [booking_id]
    );

    const qrDataUrl = await generateBookingQR(booking_id);
    await query(`UPDATE bookings SET qr_code = ? WHERE id = ?`, [qrDataUrl, booking_id]);

    if (booking.email) {
      await sendTicketEmail(booking.email, {
        booking_id: booking_id,
        full_name: booking.full_name,
        facility_name: booking.facility_name,
        booking_date: booking.booking_date,
        time_slot: booking.time_slot,
        total_amount: booking.total_amount,
        qr_code: qrDataUrl,
      });
    }

    if (booking.phone) {
      await sendBookingSMS(booking.phone, {
        full_name: booking.full_name,
        facility_name: booking.facility_name,
        booking_date: booking.booking_date,
        time_slot: booking.time_slot,
        total_amount: booking.total_amount,
        booking_id: booking_id,
      });
    }

    res.json({ success: true, message: 'Payment simulated successfully. Ticket sent.' });
  } catch (err) {
    console.error('Simulate payment error:', err);
    res.status(500).json({ success: false, message: 'Simulation failed.' });
  }
});

module.exports = router;

