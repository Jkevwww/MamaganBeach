const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// List all active resorts
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, description, location, images, amenities, created_at
       FROM resorts WHERE is_active = true ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List resorts error:', err);
    res.status(500).json({ success: false, message: 'Failed to load resorts.' });
  }
});

// Get single resort with facilities
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resortResult = await query(
      `SELECT id, name, description, location, images, amenities FROM resorts WHERE id = ? AND is_active = true`,
      [id]
    );
    if (resortResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Resort not found.' });
    }

    const facilitiesResult = await query(
      `SELECT id, name, type, description, images, base_price, capacity, total_units
       FROM facilities WHERE resort_id = ? AND is_active = true ORDER BY base_price ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...resortResult.rows[0],
        facilities: facilitiesResult.rows,
      },
    });
  } catch (err) {
    console.error('Get resort error:', err);
    res.status(500).json({ success: false, message: 'Failed to load resort details.' });
  }
});

module.exports = router;

