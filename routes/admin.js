const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Middleware: admin only
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalBookings = await query(`SELECT COUNT(*) as cnt FROM bookings`);
    const todayBookings = await query(`SELECT COUNT(*) as cnt FROM bookings WHERE booking_date = ?`, [today]);
    const pendingPayments = await query(`SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'pending'`);
    const totalRevenue = await query(`SELECT IFNULL(SUM(total_amount), 0) as rev FROM bookings WHERE payment_status = 'paid'`);
    const totalUsers = await query(`SELECT COUNT(*) as cnt FROM users WHERE role = 'guest'`);
    const totalFacilities = await query(`SELECT COUNT(*) as cnt FROM facilities`);

    const recentBookings = await query(
      `SELECT b.*, f.name as facility_name, u.full_name as guest_name
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN users u ON b.user_id = u.id
       ORDER BY b.created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        stats: {
          total_bookings: parseInt(totalBookings.rows[0].cnt),
          today_bookings: parseInt(todayBookings.rows[0].cnt),
          pending_payments: parseInt(pendingPayments.rows[0].cnt),
          total_revenue: parseFloat(totalRevenue.rows[0].rev),
          total_users: parseInt(totalUsers.rows[0].cnt),
          total_facilities: parseInt(totalFacilities.rows[0].cnt),
        },
        recent_bookings: recentBookings.rows,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
});

// Get all bookings with filters
router.get('/bookings', async (req, res) => {
  try {
    const { status, date_from, date_to, facility_id } = req.query;
    let sql = `
      SELECT b.*, f.name as facility_name, f.type as facility_type, u.full_name as guest_name, u.email, u.phone
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }
    if (date_from) {
      sql += ` AND b.booking_date >= ?`;
      params.push(date_from);
    }
    if (date_to) {
      sql += ` AND b.booking_date <= ?`;
      params.push(date_to);
    }
    if (facility_id) {
      sql += ` AND b.facility_id = ?`;
      params.push(facility_id);
    }

    sql += ` ORDER BY b.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Admin bookings error:', err);
    res.status(500).json({ success: false, message: 'Failed to load bookings.' });
  }
});

// Update booking status manually
router.patch('/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    await query(
      `UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );
    const result = await query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update booking status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update booking.' });
  }
});

// Block date for facility
router.post('/block-dates', async (req, res) => {
  try {
    const { facility_id, resort_id, block_date, reason } = req.body;
    if (!block_date || (!facility_id && !resort_id)) {
      return res.status(400).json({ success: false, message: 'block_date and facility_id or resort_id required.' });
    }

    const id = uuidv4();
    await query(
      `INSERT INTO blocked_dates (id, facility_id, resort_id, block_date, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, facility_id || null, resort_id || null, block_date, reason || null, req.user.id]
    );

    if (facility_id) {
      await query(
        `UPDATE availability SET is_blocked = true, blocked_reason = ?
         WHERE facility_id = ? AND date = ?`,
        [reason || 'Blocked by admin', facility_id, block_date]
      );
    }

    res.json({ success: true, message: 'Date blocked successfully.' });
  } catch (err) {
    console.error('Block date error:', err);
    res.status(500).json({ success: false, message: 'Failed to block date.' });
  }
});

// Get blocked dates
router.get('/block-dates', async (req, res) => {
  try {
    const { facility_id } = req.query;
    let sql = `SELECT bd.*, f.name as facility_name, u.full_name as blocked_by
               FROM blocked_dates bd
               LEFT JOIN facilities f ON bd.facility_id = f.id
               LEFT JOIN users u ON bd.created_by = u.id
               WHERE 1=1`;
    const params = [];
    if (facility_id) {
      sql += ` AND bd.facility_id = ?`;
      params.push(facility_id);
    }
    sql += ` ORDER BY bd.block_date DESC`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get blocked dates error:', err);
    res.status(500).json({ success: false, message: 'Failed to load blocked dates.' });
  }
});

// Revenue report
router.get('/reports/revenue', async (req, res) => {
  try {
    const { period } = req.query; // daily, weekly, monthly
    let groupBy, dateFormat;

    if (period === 'monthly') {
      groupBy = "DATE_FORMAT(b.booking_date, '%Y-%m')";
      dateFormat = 'month';
    } else if (period === 'weekly') {
      groupBy = "DATE_FORMAT(DATE_SUB(b.booking_date, INTERVAL WEEKDAY(b.booking_date) DAY), '%Y-%m-%d')";
      dateFormat = 'week_start';
    } else {
      groupBy = "b.booking_date";
      dateFormat = 'day';
    }

    const result = await query(
      `SELECT ${groupBy} as period, IFNULL(SUM(b.total_amount), 0) as revenue, COUNT(*) as bookings_count
       FROM bookings b
       WHERE b.payment_status = 'paid'
       GROUP BY ${groupBy}
       ORDER BY period DESC LIMIT 30`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Revenue report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate revenue report.' });
  }
});

// Occupancy report
router.get('/reports/occupancy', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const result = await query(
      `SELECT f.name as facility_name, f.type,
              COUNT(b.id) as total_bookings,
              SUM(b.quantity) as total_units_booked,
              f.total_units,
              ROUND(AVG((b.quantity / f.total_units)) * 100, 2) as occupancy_rate
       FROM facilities f
       LEFT JOIN bookings b ON f.id = b.facility_id
         AND b.payment_status = 'paid'
         AND (? IS NULL OR b.booking_date >= ?)
         AND (? IS NULL OR b.booking_date <= ?)
       WHERE f.is_active = true
       GROUP BY f.id, f.name, f.type, f.total_units
       ORDER BY total_bookings DESC`,
      [date_from || null, date_from || null, date_to || null, date_to || null]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Occupancy report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate occupancy report.' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, full_name, phone, auth_provider, role, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Failed to load users.' });
  }
});

module.exports = router;

