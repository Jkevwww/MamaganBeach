const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { verifyQRData } = require('../utils/generateQR');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'checkin-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const admissionId = req.body.admissionId || 'unknown';
    cb(null, `${admissionId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  },
});

// POST /api/checkin/upload/photo
router.post(
  '/upload/photo',
  authenticateToken,
  requireRole(['admin', 'staff']),
  upload.single('photo'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded.' });
    }
    const filePath = path.join('uploads', 'checkin-photos', req.file.filename).replace(/\\/g, '/');
    res.json({ success: true, filePath });
  }
);

// POST /api/checkin/verify
// Body: { admission_id: <raw QR string payload> }
router.post('/verify', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const admissionId = req.body?.admission_id;
    if (!admissionId) {
      return res.status(400).json({ success: false, message: 'admission_id is required.' });
    }

    const verification = verifyQRData(admissionId);
    if (!verification.valid) {
      return res.status(400).json({ success: false, message: 'Invalid or tampered QR code.' });
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
      return res.status(400).json({ success: false, message: 'Booking payment is not confirmed.' });
    }

    if (booking.status === 'completed') {
      return res.status(409).json({
        success: false,
        message: 'Guest has already been checked in.',
        data: booking,
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This booking has been cancelled.' });
    }

    await query(
      `UPDATE bookings SET status = 'completed', checked_in_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [bookingId]
    );

    booking.status = 'completed';
    booking.checked_in_at = new Date().toISOString();

    return res.json({ success: true, message: 'Check-in successful!', data: booking });
  } catch (err) {
    console.error('Check-in verify error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify QR code.' });
  }
});

module.exports = router;
