const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { facilitySchema } = require('../utils/validators');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

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
    res.json({ success: true, data: result.rows[0] });
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
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { error, value } = facilitySchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { resort_id, name, type, description, base_price, capacity, total_units } = value;
    const id = uuidv4();
    await query(
      `INSERT INTO facilities (id, resort_id, name, type, description, base_price, capacity, total_units)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, resort_id, name, type, description || null, base_price, capacity, total_units]
    );
    const result = await query('SELECT * FROM facilities WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to create facility.' });
  }
});

// Admin: Update facility
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, base_price, capacity, total_units, is_active } = req.body;
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
    const result = await query('SELECT * FROM facilities WHERE id = ?', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facility not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
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

