// POST /checkin/upload/photo
router.post('/upload/photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No photo uploaded.' });
  }

  const filePath = path.join('uploads', 'checkin-photos', req.file.filename).replace(/\\/g, '/');
  res.json({ success: true, filePath });
});

// POST /checkin/upload/video
router.post('/upload/video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No video uploaded.' });
  }

  const filePath = path.join('uploads', 'checkin-videos', req.file.filename).replace(/\\/g, '/');
  res.json({ success: true, filePath });
});const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'checkin-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const admissionId = req.body.admissionId || 'unknown';
    const fileName = `${admissionId}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, fileName);
  }
});

const upload = multer({ storage });

// POST /checkin/upload/photo
router.post('/upload/photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No photo uploaded.' });
  }

  const filePath = path.join('uploads', 'checkin-photos', req.file.filename).replace(/\\/g, '/');
  res.json({ success: true, filePath });
});

// POST /checkin/verify
router.post('/verify', async (req, res) => {
    const { qrData } = req.body;
    if (!qrData) {
        return res.status(400).json({ success: false, message: 'QR data is required.' });
    }

    try {
        const [admissions] = await db.promise().query('SELECT * FROM admissions WHERE id = ?', [qrData]);
        if (admissions.length === 0) {
            return res.status(404).json({ success: false, message: 'Admission pass not found.' });
        }

        const admission = admissions[0];
        if (admission.checkin_time) {
            return res.status(409).json({ success: false, message: 'This pass has already been used.' });
        }

        const checkinTime = new Date();
        await db.promise().query('UPDATE admissions SET checkin_time = ? WHERE id = ?', [checkinTime, qrData]);

        const [guests] = await db.promise().query('SELECT * FROM guests WHERE id = ?', [admission.guest_id]);
        const [bookings] = await db.promise().query('SELECT * FROM bookings WHERE id = ?', [admission.booking_id]);

        res.json({
            success: true,
            data: {
                admission: { ...admission, checkin_time: checkinTime },
                guest: guests[0],
                booking: bookings[0]
            }
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during verification.' });
    }
});

module.exports = router;// POST /checkin/upload/photo
router.post('/upload/photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No photo uploaded.' });
  }

  const filePath = path.join('uploads', 'checkin-photos', req.file.filename).replace(/\/g, '/');
  res.json({ success: true, filePath });
});

// POST /checkin/upload/video
router.post('/upload/video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No video uploaded.' });
  }

  const filePath = path.join('uploads', 'checkin-videos', req.file.filename).replace(/\/g, '/');
  res.json({ success: true, filePath });
});