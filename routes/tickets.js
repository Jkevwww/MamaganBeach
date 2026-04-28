const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { verifyQRData } = require('../utils/generateQR');

const router = express.Router();

// Get my ticket details
router.get('/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const result = await query(
      `SELECT b.*, f.name as facility_name, f.type as facility_type, r.name as resort_name, r.location
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN resorts r ON f.resort_id = r.id
       WHERE b.id = ? AND b.user_id = ? AND b.payment_status = 'paid'`,
      [bookingId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found or not paid.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ success: false, message: 'Failed to load ticket.' });
  }
});

// Admin/Staff: Verify QR and check in guest
router.post('/verify', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { qr_payload } = req.body;
    if (!qr_payload) {
      return res.status(400).json({ success: false, message: 'QR payload is required.' });
    }

    const verification = verifyQRData(qr_payload);
    if (!verification.valid) {
      return res.status(400).json({ success: false, message: 'Invalid QR code.' });
    }

    const bookingId = verification.booking_id;
    const result = await query(
      `SELECT b.*, f.name as facility_name, u.full_name as guest_name, u.email, u.phone
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = result.rows[0];

    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Booking is not paid.' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Guest already checked in.', data: booking });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking was cancelled.' });
    }

    // Mark as checked in
    await query(
      `UPDATE bookings SET status = 'completed', checked_in_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [bookingId]
    );

    booking.status = 'completed';
    booking.checked_in_at = new Date().toISOString();

    res.json({ success: true, message: 'Check-in successful!', data: booking });
  } catch (err) {
    console.error('Verify QR error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify QR code.' });
  }
});

module.exports = router;

