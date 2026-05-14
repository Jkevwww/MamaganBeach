const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// In-memory store for email verification codes { email -> { code, expiresAt } }
const emailVerificationCodes = new Map();

// Avatar upload setup
const avatarDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/settings/profile
router.get('/profile', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, full_name, phone, avatar_url, role, auth_provider, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to load profile.' });
  }
});

// PUT /api/settings/profile
router.put('/profile', async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters.' });
    }
    await query(
      'UPDATE users SET full_name = ?, phone = ? WHERE id = ?',
      [full_name.trim(), phone?.trim() || null, req.user.id]
    );
    const result = await query(
      'SELECT id, email, full_name, phone, avatar_url, role FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, message: 'Profile updated successfully.', data: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// POST /api/settings/change-password
router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ success: false, message: 'All password fields are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'This account uses social login. Password cannot be changed here.',
      });
    }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// POST /api/settings/upload-avatar
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded.' });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.id]);
    res.json({ success: true, message: 'Profile photo updated.', avatar_url: avatarUrl });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload photo.' });
  }
});

// POST /api/settings/send-verification
// Sends a 6-digit code to the user's email address on file
router.post('/send-verification', async (req, res) => {
  try {
    const result = await query('SELECT email, full_name FROM users WHERE id = ?', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const { email, full_name } = result.rows[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    emailVerificationCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    // Try to send email via the email service
    try {
      const { sendTicketEmail } = require('../services/emailService');
      await sendTicketEmail(email, {
        full_name,
        facility_name: `Your verification code is: ${code}`,
        booking_date: new Date().toLocaleDateString(),
        time_slot: 'Valid for 10 minutes. Do not share this code.',
        total_amount: 0,
        booking_id: 'EMAIL-VERIFY',
        qr_code: null,
      });
    } catch (emailErr) {
      console.error('Email send error (non-fatal):', emailErr);
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email.',
      // Expose code in non-production for testing
      ...(process.env.NODE_ENV !== 'production' && { code }),
    });
  } catch (err) {
    console.error('Send verification error:', err);
    res.status(500).json({ success: false, message: 'Failed to send verification code.' });
  }
});

// POST /api/settings/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }

    const result = await query('SELECT email FROM users WHERE id = ?', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const { email } = result.rows[0];
    const stored = emailVerificationCodes.get(email);

    if (!stored || Date.now() > stored.expiresAt) {
      return res.status(400).json({ success: false, message: 'Code expired. Please request a new one.' });
    }
    if (stored.code !== code.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    emailVerificationCodes.delete(email);
    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify email.' });
  }
});

module.exports = router;
