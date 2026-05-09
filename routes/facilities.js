const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { facilitySchema } = require('../utils/validators');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Multer: facility image uploads (local file)
const uploadDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeExt = ext && ext.length <= 10 ? ext : '.jpg';
    cb(null, `${Date.now()}-${uuidv4()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Invalid image type.')); 
    cb(null, true);
  },
});

// Get all facilities
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT f.*, r.name as resort_name FROM facilities f
       JOIN resorts r ON f.resort_id = r.id ORDER BY f.created_at DESC`
    );

    const rows = result.rows.map(r => {
      const out = { ...r };
      if (typeof out.images === 'string') {
        try { out.images = JSON.parse(out.images); } catch (e) { out.images = []; }
      }
      if (!Array.isArray(out.images)) out.images = [];
      return out;
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get facilities error:', err);
    res.status(500).json({ success: false, message: 'Failed to load facilities.' });
  }
});

// Get facility details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT f.*, r.name as resort_name FROM facilities f
       JOIN resorts r ON f.resort_id = r.id WHERE f.id = ?`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facility not found.' });
    }

    const row = result.rows[0];
    if (typeof row.images === 'string') {
      try { row.images = JSON.parse(row.images); } catch (e) { row.images = []; }
    }
    if (!Array.isArray(row.images)) row.images = [];

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('Get facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to load facility.' });
  }
});

// Check availability for a facility by date range
router.get('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date parameter is required.' });
    }

    const result = await query(
      `SELECT date, time_slot, available, is_blocked, blocked_reason
       FROM availability WHERE facility_id = ? AND date = ? ORDER BY time_slot`,
      [id, date]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Availability error:', err);
    res.status(500).json({ success: false, message: 'Failed to load availability.' });
  }
});

// Admin: Create facility
router.post('/', upload.single('image_file'), authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { error, value } = facilitySchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { resort_id, name, type, description, base_price, capacity, total_units } = value;
    const id = uuidv4();

    const images = [];
    if (req.file) {
      // stored as local URL path for the frontend
      images.push(`/images/uploads/${req.file.filename}`);
    }
    if (req.body.images_link) {
      images.push(req.body.images_link);
    }

    await query(
      `INSERT INTO facilities (id, resort_id, name, type, description, images, base_price, capacity, total_units)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, resort_id, name, type, description || null, images.length ? JSON.stringify(images) : JSON.stringify([]), base_price, capacity, total_units]
    );

    const result = await query('SELECT * FROM facilities WHERE id = ?', [id]);
    // normalize images field
    const created = result.rows[0];
    if (typeof created.images === 'string') {
      try { created.images = JSON.parse(created.images); } catch (e) { created.images = []; }
    }

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to create facility.' });
  }
});

// Admin: Update facility
router.put('/:id', upload.single('image_file'), authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, base_price, capacity, total_units, is_active, images_link } = req.body;

    const images = [];
    if (req.file) {
      images.push(`/images/uploads/${req.file.filename}`);
    }
    if (images_link) {
      images.push(images_link);
    }

    // If images were provided, overwrite `images`.
    // Otherwise keep existing images.
    const shouldUpdateImages = images.length > 0;

    if (shouldUpdateImages) {
      await query(
        `UPDATE facilities SET 
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         base_price = COALESCE(?, base_price),
         capacity = COALESCE(?, capacity),
         total_units = COALESCE(?, total_units),
         is_active = COALESCE(?, is_active),
         images = ?
         WHERE id = ?`,
        [name, description, base_price, capacity, total_units, is_active, JSON.stringify(images), id]
      );
    } else {
      await query(
        `UPDATE facilities SET 
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         base_price = COALESCE(?, base_price),
         capacity = COALESCE(?, capacity),
         total_units = COALESCE(?, total_units),
         is_active = COALESCE(?, is_active)
         WHERE id = ?`,
        [name, description, base_price, capacity, total_units, is_active, id]
      );
    }

    const result = await query('SELECT * FROM facilities WHERE id = ?', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facility not found.' });
    }

    const updated = result.rows[0];
    if (typeof updated.images === 'string') {
      try { updated.images = JSON.parse(updated.images); } catch (e) { updated.images = []; }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to update facility.' });
  }
});

// Admin: Delete facility
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if facility has bookings
    const bookings = await query('SELECT id FROM bookings WHERE facility_id = ? LIMIT 1', [id]);
    if (bookings.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete facility with existing bookings. Mark it as inactive instead.' });
    }

    const result = await query('DELETE FROM facilities WHERE id = ?', [id]);
    if (result.rows.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Facility not found.' });
    }
    res.json({ success: true, message: 'Facility deleted successfully.' });
  } catch (err) {
    console.error('Delete facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete facility.' });
  }
});

module.exports = router;

