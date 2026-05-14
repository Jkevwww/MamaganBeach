const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ── Auth middleware ────────────────────────────────────────────────────────────
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ── Helper: write a system log entry ─────────────────────────────────────────
async function writeLog(req, { action, module, target_type = null, target_id = null, details = null }) {
  try {
    const user = req.user || {};
    await query(
      `INSERT INTO system_logs
         (id, user_id, user_name, user_role, action, module, target_type, target_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(),
        user.id || null,
        user.full_name || user.email || null,
        user.role || null,
        action,
        module,
        target_type,
        target_id ? String(target_id) : null,
        details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        req.ip || null,
        req.get('user-agent') || null,
      ]
    );
  } catch (_) {
    // Logging must never crash the main request
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalBookings,
      todayBookings,
      pendingPayments,
      totalRevenue,
      totalUsers,
      totalFacilities,
      recentBookings,
      revenueWeek,
      bookingsByStatus,
    ] = await Promise.all([
      query(`SELECT COUNT(*) as cnt FROM bookings`),
      query(`SELECT COUNT(*) as cnt FROM bookings WHERE booking_date = ?`, [today]),
      query(`SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'pending' AND status != 'cancelled'`),
      query(`SELECT IFNULL(SUM(total_amount), 0) as rev FROM bookings WHERE payment_status = 'paid'`),
      query(`SELECT COUNT(*) as cnt FROM users WHERE role = 'guest'`),
      query(`SELECT COUNT(*) as cnt FROM facilities WHERE is_active = 1`),
      query(
        `SELECT b.id, b.booking_date, b.time_slot, b.status, b.payment_status, b.total_amount,
                f.name as facility_name, u.full_name as guest_name, u.email
         FROM bookings b
         JOIN facilities f ON b.facility_id = f.id
         JOIN users u ON b.user_id = u.id
         ORDER BY b.created_at DESC LIMIT 10`
      ),
      query(
        `SELECT DATE(b.created_at) as day, IFNULL(SUM(b.total_amount),0) as revenue, COUNT(*) as cnt
         FROM bookings b
         WHERE b.payment_status = 'paid' AND b.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY DATE(b.created_at) ORDER BY day ASC`
      ),
      query(
        `SELECT status, COUNT(*) as cnt FROM bookings GROUP BY status`
      ),
    ]);

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
        revenue_week: revenueWeek.rows,
        bookings_by_status: bookingsByStatus.rows,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/bookings — list with filters
router.get('/bookings', async (req, res) => {
  try {
    const { status, payment_status, date_from, date_to, facility_id, search } = req.query;

    let sql = `
      SELECT b.id, b.booking_date, b.time_slot, b.status, b.payment_status, b.total_amount,
             b.quantity, b.guest_count, b.booking_type, b.rejection_reason, b.admin_note,
             b.created_at, b.updated_at,
             f.name as facility_name, f.category as facility_category,
             u.full_name as guest_name, u.email as guest_email, u.phone as guest_phone,
             p.gcash_ref_no, p.gcash_audit_status
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      JOIN users u ON b.user_id = u.id
      LEFT JOIN payments p ON b.id = p.booking_id
      WHERE 1=1
    `;
    const params = [];

    if (status) { sql += ` AND b.status = ?`; params.push(status); }
    if (payment_status) { sql += ` AND b.payment_status = ?`; params.push(payment_status); }
    if (date_from) { sql += ` AND b.booking_date >= ?`; params.push(date_from); }
    if (date_to) { sql += ` AND b.booking_date <= ?`; params.push(date_to); }
    if (facility_id) { sql += ` AND b.facility_id = ?`; params.push(facility_id); }
    if (search) {
      sql += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR b.id LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    sql += ` ORDER BY b.created_at DESC LIMIT 200`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Admin bookings list error:', err);
    res.status(500).json({ success: false, message: 'Failed to load bookings.' });
  }
});

// GET /api/admin/bookings/:id — single booking detail
router.get('/bookings/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, f.name as facility_name, f.category as facility_category,
              u.full_name as guest_name, u.email as guest_email, u.phone as guest_phone,
              p.gcash_ref_no, p.gcash_audit_status, p.gcash_audit_note,
              p.gcash_audited_at, au.full_name as gcash_audited_by_name
       FROM bookings b
       JOIN facilities f ON b.facility_id = f.id
       JOIN users u ON b.user_id = u.id
       LEFT JOIN payments p ON b.id = p.booking_id
       LEFT JOIN users au ON p.gcash_audited_by = au.id
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Booking detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to load booking.' });
  }
});

// PATCH /api/admin/bookings/:id/confirm
router.patch('/bookings/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;
    const booking = await query(`SELECT * FROM bookings WHERE id = ?`, [id]);
    if (booking.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.rows[0].status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot confirm a cancelled booking.' });

    await query(
      `UPDATE bookings SET status = 'confirmed', admin_note = ?, updated_at = NOW() WHERE id = ?`,
      [admin_note || null, id]
    );
    await writeLog(req, { action: 'CONFIRM_BOOKING', module: 'bookings', target_type: 'booking', target_id: id, details: admin_note });
    res.json({ success: true, message: 'Booking confirmed.' });
  } catch (err) {
    console.error('Confirm booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to confirm booking.' });
  }
});

// PATCH /api/admin/bookings/:id/reject
router.patch('/bookings/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const booking = await query(`SELECT * FROM bookings WHERE id = ?`, [id]);
    if (booking.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.rows[0].status === 'cancelled') return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });

    await query(
      `UPDATE bookings SET status = 'cancelled', rejection_reason = ?, updated_at = NOW() WHERE id = ?`,
      [rejection_reason.trim(), id]
    );
    await writeLog(req, { action: 'REJECT_BOOKING', module: 'bookings', target_type: 'booking', target_id: id, details: rejection_reason });
    res.json({ success: true, message: 'Booking rejected.' });
  } catch (err) {
    console.error('Reject booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to reject booking.' });
  }
});

// PATCH /api/admin/bookings/:id/cancel
router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const booking = await query(`SELECT * FROM bookings WHERE id = ?`, [id]);
    if (booking.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.rows[0].status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled.' });

    await query(
      `UPDATE bookings SET status = 'cancelled', admin_note = ?, updated_at = NOW() WHERE id = ?`,
      [admin_note || null, id]
    );
    await writeLog(req, { action: 'CANCEL_BOOKING', module: 'bookings', target_type: 'booking', target_id: id });
    res.json({ success: true, message: 'Booking cancelled.' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel booking.' });
  }
});

// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', async (req, res) => {
  try {
    const result = await query(`SELECT id FROM bookings WHERE id = ?`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found.' });
    await query(`DELETE FROM bookings WHERE id = ?`, [req.params.id]);
    await writeLog(req, { action: 'DELETE_BOOKING', module: 'bookings', target_type: 'booking', target_id: req.params.id });
    res.json({ success: true, message: 'Booking deleted.' });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete booking.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FACILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/facilities
router.get('/facilities', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = `SELECT * FROM facilities WHERE 1=1`;
    const params = [];
    if (category) { sql += ` AND category = ?`; params.push(category); }
    sql += ` ORDER BY category, name`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Admin facilities list error:', err);
    res.status(500).json({ success: false, message: 'Failed to load facilities.' });
  }
});

// GET /api/admin/facilities/:id
router.get('/facilities/:id', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM facilities WHERE id = ?`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Facility not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Facility detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to load facility.' });
  }
});

// POST /api/admin/facilities
router.post('/facilities', async (req, res) => {
  try {
    const {
      name, category, description, capacity_min, capacity_max, total_units,
      base_price, bookable, unavailable_reason, restricted_during_peak_hours, images_link,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'name and category are required.' });
    }
    const validCategories = ['cottage', 'cabana', 'beach_equipment'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${validCategories.join(', ')}` });
    }

    const id = uuidv4();
    await query(
      `INSERT INTO facilities
         (id, name, category, description, capacity_min, capacity_max, total_units,
          base_price, bookable, unavailable_reason, restricted_during_peak_hours, images_link,
          is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [
        id, name.trim(), category,
        description?.trim() || null,
        parseInt(capacity_min) || 1,
        parseInt(capacity_max) || 30,
        parseInt(total_units) || 1,
        parseFloat(base_price) || 0,
        bookable === false || bookable === 'false' ? 0 : 1,
        unavailable_reason?.trim() || null,
        restricted_during_peak_hours ? 1 : 0,
        images_link?.trim() || null,
      ]
    );

    const created = await query(`SELECT * FROM facilities WHERE id = ?`, [id]);
    await writeLog(req, { action: 'CREATE_FACILITY', module: 'facilities', target_type: 'facility', target_id: id, details: name });
    res.status(201).json({ success: true, message: 'Facility created.', data: created.rows[0] });
  } catch (err) {
    console.error('Create facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to create facility.' });
  }
});

// PUT /api/admin/facilities/:id
router.put('/facilities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT id FROM facilities WHERE id = ?`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Facility not found.' });

    const {
      name, category, description, capacity_min, capacity_max, total_units,
      base_price, bookable, unavailable_reason, restricted_during_peak_hours, images_link, is_active,
    } = req.body;

    await query(
      `UPDATE facilities SET
         name = COALESCE(?, name),
         category = COALESCE(?, category),
         description = ?,
         capacity_min = COALESCE(?, capacity_min),
         capacity_max = COALESCE(?, capacity_max),
         total_units = COALESCE(?, total_units),
         base_price = COALESCE(?, base_price),
         bookable = COALESCE(?, bookable),
         unavailable_reason = ?,
         restricted_during_peak_hours = COALESCE(?, restricted_during_peak_hours),
         images_link = ?,
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name?.trim() || null,
        category || null,
        description !== undefined ? (description?.trim() || null) : undefined,
        capacity_min !== undefined ? parseInt(capacity_min) : null,
        capacity_max !== undefined ? parseInt(capacity_max) : null,
        total_units !== undefined ? parseInt(total_units) : null,
        base_price !== undefined ? parseFloat(base_price) : null,
        bookable !== undefined ? (bookable === false || bookable === 'false' ? 0 : 1) : null,
        unavailable_reason !== undefined ? (unavailable_reason?.trim() || null) : undefined,
        restricted_during_peak_hours !== undefined ? (restricted_during_peak_hours ? 1 : 0) : null,
        images_link !== undefined ? (images_link?.trim() || null) : undefined,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
      ]
    );

    const updated = await query(`SELECT * FROM facilities WHERE id = ?`, [id]);
    await writeLog(req, { action: 'UPDATE_FACILITY', module: 'facilities', target_type: 'facility', target_id: id });
    res.json({ success: true, message: 'Facility updated.', data: updated.rows[0] });
  } catch (err) {
    console.error('Update facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to update facility.' });
  }
});

// DELETE /api/admin/facilities/:id  — soft delete (deactivate)
router.delete('/facilities/:id', async (req, res) => {
  try {
    const existing = await query(`SELECT id, name FROM facilities WHERE id = ?`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Facility not found.' });
    await query(`UPDATE facilities SET is_active = FALSE WHERE id = ?`, [req.params.id]);
    await writeLog(req, { action: 'DEACTIVATE_FACILITY', module: 'facilities', target_type: 'facility', target_id: req.params.id, details: existing.rows[0].name });
    res.json({ success: true, message: 'Facility deactivated.' });
  } catch (err) {
    console.error('Delete facility error:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate facility.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROMOS / RATES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/promos
router.get('/promos', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM promos ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get promos error:', err);
    res.status(500).json({ success: false, message: 'Failed to load promos.' });
  }
});

// POST /api/admin/promos
router.post('/promos', async (req, res) => {
  try {
    const { title, description, discount_type, discount_value, applies_to, valid_from, valid_until, is_active } = req.body;
    if (!title || !discount_type || discount_value === undefined) {
      return res.status(400).json({ success: false, message: 'title, discount_type, and discount_value are required.' });
    }
    if (!['percent', 'fixed'].includes(discount_type)) {
      return res.status(400).json({ success: false, message: 'discount_type must be percent or fixed.' });
    }

    const id = uuidv4();
    await query(
      `INSERT INTO promos
         (id, title, description, discount_type, discount_value, applies_to, valid_from, valid_until, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        title.trim(),
        description?.trim() || null,
        discount_type,
        parseFloat(discount_value),
        applies_to || 'all',
        valid_from || null,
        valid_until || null,
        is_active !== false ? 1 : 0,
      ]
    );
    const created = await query(`SELECT * FROM promos WHERE id = ?`, [id]);
    await writeLog(req, { action: 'CREATE_PROMO', module: 'promos', target_type: 'promo', target_id: id, details: title });
    res.status(201).json({ success: true, message: 'Promo created.', data: created.rows[0] });
  } catch (err) {
    console.error('Create promo error:', err);
    res.status(500).json({ success: false, message: 'Failed to create promo.' });
  }
});

// PUT /api/admin/promos/:id
router.put('/promos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT id FROM promos WHERE id = ?`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Promo not found.' });

    const { title, description, discount_type, discount_value, applies_to, valid_from, valid_until, is_active } = req.body;
    await query(
      `UPDATE promos SET
         title = COALESCE(?, title),
         description = ?,
         discount_type = COALESCE(?, discount_type),
         discount_value = COALESCE(?, discount_value),
         applies_to = COALESCE(?, applies_to),
         valid_from = ?,
         valid_until = ?,
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        title?.trim() || null,
        description !== undefined ? (description?.trim() || null) : undefined,
        discount_type || null,
        discount_value !== undefined ? parseFloat(discount_value) : null,
        applies_to || null,
        valid_from !== undefined ? (valid_from || null) : undefined,
        valid_until !== undefined ? (valid_until || null) : undefined,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
      ]
    );
    const updated = await query(`SELECT * FROM promos WHERE id = ?`, [id]);
    await writeLog(req, { action: 'UPDATE_PROMO', module: 'promos', target_type: 'promo', target_id: id });
    res.json({ success: true, message: 'Promo updated.', data: updated.rows[0] });
  } catch (err) {
    console.error('Update promo error:', err);
    res.status(500).json({ success: false, message: 'Failed to update promo.' });
  }
});

// PATCH /api/admin/promos/:id/toggle — enable/disable
router.patch('/promos/:id/toggle', async (req, res) => {
  try {
    const existing = await query(`SELECT id, is_active FROM promos WHERE id = ?`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Promo not found.' });
    const newState = existing.rows[0].is_active ? 0 : 1;
    await query(`UPDATE promos SET is_active = ? WHERE id = ?`, [newState, req.params.id]);
    await writeLog(req, { action: newState ? 'ENABLE_PROMO' : 'DISABLE_PROMO', module: 'promos', target_type: 'promo', target_id: req.params.id });
    res.json({ success: true, message: `Promo ${newState ? 'enabled' : 'disabled'}.`, is_active: !!newState });
  } catch (err) {
    console.error('Toggle promo error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle promo.' });
  }
});

// DELETE /api/admin/promos/:id
router.delete('/promos/:id', async (req, res) => {
  try {
    const existing = await query(`SELECT id FROM promos WHERE id = ?`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Promo not found.' });
    await query(`DELETE FROM promos WHERE id = ?`, [req.params.id]);
    await writeLog(req, { action: 'DELETE_PROMO', module: 'promos', target_type: 'promo', target_id: req.params.id });
    res.json({ success: true, message: 'Promo deleted.' });
  } catch (err) {
    console.error('Delete promo error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete promo.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLACKOUT PERIODS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/blackouts
router.get('/blackouts', async (req, res) => {
  try {
    const { facility_id, from, to, active_only } = req.query;
    let sql = `
      SELECT bp.*, f.name as facility_name, u.full_name as created_by_name
      FROM blackout_periods bp
      LEFT JOIN facilities f ON bp.facility_id = f.id
      LEFT JOIN users u ON bp.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (facility_id) { sql += ` AND bp.facility_id = ?`; params.push(facility_id); }
    if (from) { sql += ` AND bp.block_date >= ?`; params.push(from); }
    if (to) { sql += ` AND bp.block_date <= ?`; params.push(to); }
    if (active_only === 'true') { sql += ` AND bp.is_active = 1`; }
    sql += ` ORDER BY bp.block_date ASC, bp.start_time ASC`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get blackouts error:', err);
    res.status(500).json({ success: false, message: 'Failed to load blackout periods.' });
  }
});

// POST /api/admin/blackouts
router.post('/blackouts', async (req, res) => {
  try {
    const { facility_id, category, block_date, start_time, end_time, reason } = req.body;
    if (!block_date) return res.status(400).json({ success: false, message: 'block_date is required.' });

    const id = uuidv4();
    await query(
      `INSERT INTO blackout_periods
         (id, facility_id, category, block_date, start_time, end_time, reason, is_active, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())`,
      [id, facility_id || null, category || null, block_date, start_time || null, end_time || null, reason?.trim() || null, req.user.id]
    );
    const created = await query(`SELECT * FROM blackout_periods WHERE id = ?`, [id]);
    await writeLog(req, { action: 'CREATE_BLACKOUT', module: 'calendar', target_type: 'blackout', target_id: id, details: block_date });
    res.status(201).json({ success: true, message: 'Blackout period created.', data: created.rows[0] });
  } catch (err) {
    console.error('Create blackout error:', err);
    res.status(500).json({ success: false, message: 'Failed to create blackout period.' });
  }
});

// PUT /api/admin/blackouts/:id
router.put('/blackouts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT id FROM blackout_periods WHERE id = ?`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Blackout period not found.' });

    const { facility_id, category, block_date, start_time, end_time, reason } = req.body;
    await query(
      `UPDATE blackout_periods SET
         facility_id = ?, category = ?, block_date = COALESCE(?, block_date),
         start_time = ?, end_time = ?, reason = ?
       WHERE id = ?`,
      [facility_id || null, category || null, block_date || null, start_time || null, end_time || null, reason?.trim() || null, id]
    );
    const updated = await query(`SELECT * FROM blackout_periods WHERE id = ?`, [id]);
    await writeLog(req, { action: 'UPDATE_BLACKOUT', module: 'calendar', target_type: 'blackout', target_id: id });
    res.json({ success: true, message: 'Blackout period updated.', data: updated.rows[0] });
  } catch (err) {
    console.error('Update blackout error:', err);
    res.status(500).json({ success: false, message: 'Failed to update blackout period.' });
  }
});

// PATCH /api/admin/blackouts/:id/toggle
router.patch('/blackouts/:id/toggle', async (req, res) => {
  try {
    const existing = await query(`SELECT id, is_active FROM blackout_periods WHERE id = ?`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Blackout period not found.' });
    const newState = existing.rows[0].is_active ? 0 : 1;
    await query(`UPDATE blackout_periods SET is_active = ? WHERE id = ?`, [newState, req.params.id]);
    res.json({ success: true, message: `Blackout ${newState ? 'activated' : 'deactivated'}.`, is_active: !!newState });
  } catch (err) {
    console.error('Toggle blackout error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle blackout period.' });
  }
});

// DELETE /api/admin/blackouts/:id
router.delete('/blackouts/:id', async (req, res) => {
  try {
    const existing = await query(`SELECT id FROM blackout_periods WHERE id = ?`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Blackout period not found.' });
    await query(`DELETE FROM blackout_periods WHERE id = ?`, [req.params.id]);
    await writeLog(req, { action: 'DELETE_BLACKOUT', module: 'calendar', target_type: 'blackout', target_id: req.params.id });
    res.json({ success: true, message: 'Blackout period deleted.' });
  } catch (err) {
    console.error('Delete blackout error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete blackout period.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS (USERS)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/clients
router.get('/clients', async (req, res) => {
  try {
    const { role, search, is_active } = req.query;
    let sql = `SELECT id, email, full_name, phone, avatar_url, role, auth_provider, is_active, created_at FROM users WHERE 1=1`;
    const params = [];
    if (role) { sql += ` AND role = ?`; params.push(role); }
    if (is_active !== undefined) { sql += ` AND is_active = ?`; params.push(is_active === 'true' ? 1 : 0); }
    if (search) {
      sql += ` AND (full_name LIKE ? OR email LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like);
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ success: false, message: 'Failed to load clients.' });
  }
});

// GET /api/admin/clients/:id — client detail + booking history
router.get('/clients/:id', async (req, res) => {
  try {
    const userRes = await query(
      `SELECT id, email, full_name, phone, avatar_url, role, auth_provider, is_active, created_at FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    const bookingsRes = await query(
      `SELECT b.id, b.booking_date, b.time_slot, b.status, b.payment_status, b.total_amount, f.name as facility_name
       FROM bookings b JOIN facilities f ON b.facility_id = f.id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ success: true, data: { user: userRes.rows[0], bookings: bookingsRes.rows } });
  } catch (err) {
    console.error('Client detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to load client.' });
  }
});

// PATCH /api/admin/clients/:id — update role or is_active
router.patch('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;
    const existing = await query(`SELECT id, role FROM users WHERE id = ?`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot modify your own account status.' });
    }

    const updates = [];
    const params = [];
    if (role !== undefined) {
      const validRoles = ['guest', 'admin', 'staff'];
      if (!validRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
      updates.push('role = ?');
      params.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'Nothing to update.' });

    params.push(id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    await writeLog(req, { action: 'UPDATE_CLIENT', module: 'clients', target_type: 'user', target_id: id, details: JSON.stringify({ role, is_active }) });
    const updated = await query(`SELECT id, email, full_name, role, is_active FROM users WHERE id = ?`, [id]);
    res.json({ success: true, message: 'User updated.', data: updated.rows[0] });
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM LOGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/logs
router.get('/logs', async (req, res) => {
  try {
    const { module, action, user_id, from, to, search } = req.query;
    let sql = `SELECT * FROM system_logs WHERE 1=1`;
    const params = [];
    if (module) { sql += ` AND module = ?`; params.push(module); }
    if (action) { sql += ` AND action = ?`; params.push(action); }
    if (user_id) { sql += ` AND user_id = ?`; params.push(user_id); }
    if (from) { sql += ` AND created_at >= ?`; params.push(from); }
    if (to) { sql += ` AND created_at <= ?`; params.push(to + ' 23:59:59'); }
    if (search) {
      sql += ` AND (user_name LIKE ? OR details LIKE ? OR action LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to load logs.' });
  }
});

// DELETE /api/admin/logs — clear all logs (admin only)
router.delete('/logs', async (req, res) => {
  try {
    await query(`DELETE FROM system_logs`);
    await writeLog(req, { action: 'CLEAR_LOGS', module: 'logs', details: 'All system logs cleared.' });
    res.json({ success: true, message: 'System logs cleared.' });
  } catch (err) {
    console.error('Clear logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to clear logs.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GCASH AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/gcash — pending GCash payments to audit
router.get('/gcash', async (req, res) => {
  try {
    const { audit_status, search } = req.query;
    let sql = `
      SELECT p.*, b.booking_date, b.time_slot, b.total_amount as booking_amount,
             f.name as facility_name, u.full_name as guest_name, u.email as guest_email
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN facilities f ON b.facility_id = f.id
      JOIN users u ON b.user_id = u.id
      WHERE p.gcash_ref_no IS NOT NULL
    `;
    const params = [];
    if (audit_status) { sql += ` AND p.gcash_audit_status = ?`; params.push(audit_status); }
    else { sql += ` AND p.gcash_audit_status = 'pending'`; }
    if (search) {
      sql += ` AND (p.gcash_ref_no LIKE ? OR u.full_name LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like);
    }
    sql += ` ORDER BY p.created_at ASC`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GCash list error:', err);
    res.status(500).json({ success: false, message: 'Failed to load GCash payments.' });
  }
});

// PATCH /api/admin/gcash/:payment_id/approve
router.patch('/gcash/:payment_id/approve', async (req, res) => {
  try {
    const { payment_id } = req.params;
    const { note } = req.body;
    const payRes = await query(`SELECT * FROM payments WHERE id = ?`, [payment_id]);
    if (payRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Payment not found.' });

    await query(
      `UPDATE payments SET gcash_audit_status = 'approved', gcash_audit_note = ?,
         gcash_audited_by = ?, gcash_audited_at = NOW()
       WHERE id = ?`,
      [note?.trim() || null, req.user.id, payment_id]
    );
    // Mark booking as paid
    await query(
      `UPDATE bookings SET payment_status = 'paid', status = 'confirmed', updated_at = NOW()
       WHERE id = ?`,
      [payRes.rows[0].booking_id]
    );
    await writeLog(req, { action: 'GCASH_APPROVE', module: 'gcash', target_type: 'payment', target_id: payment_id });
    res.json({ success: true, message: 'GCash payment approved and booking confirmed.' });
  } catch (err) {
    console.error('GCash approve error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve GCash payment.' });
  }
});

// PATCH /api/admin/gcash/:payment_id/reject
router.patch('/gcash/:payment_id/reject', async (req, res) => {
  try {
    const { payment_id } = req.params;
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, message: 'Rejection note is required.' });

    const payRes = await query(`SELECT * FROM payments WHERE id = ?`, [payment_id]);
    if (payRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Payment not found.' });

    await query(
      `UPDATE payments SET gcash_audit_status = 'rejected', gcash_audit_note = ?,
         gcash_audited_by = ?, gcash_audited_at = NOW()
       WHERE id = ?`,
      [note.trim(), req.user.id, payment_id]
    );
    await query(
      `UPDATE bookings SET payment_status = 'failed', updated_at = NOW() WHERE id = ?`,
      [payRes.rows[0].booking_id]
    );
    await writeLog(req, { action: 'GCASH_REJECT', module: 'gcash', target_type: 'payment', target_id: payment_id, details: note });
    res.json({ success: true, message: 'GCash payment rejected.' });
  } catch (err) {
    console.error('GCash reject error:', err);
    res.status(500).json({ success: false, message: 'Failed to reject GCash payment.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/reports/revenue?period=daily|weekly|monthly&date_from=&date_to=
router.get('/reports/revenue', async (req, res) => {
  try {
    const { period = 'daily', date_from, date_to } = req.query;

    let groupBy;
    if (period === 'monthly') groupBy = "DATE_FORMAT(b.booking_date, '%Y-%m')";
    else if (period === 'weekly') groupBy = "DATE_FORMAT(DATE_SUB(b.booking_date, INTERVAL WEEKDAY(b.booking_date) DAY), '%Y-%m-%d')";
    else groupBy = "b.booking_date";

    let sql = `
      SELECT ${groupBy} as period,
             IFNULL(SUM(b.total_amount), 0) as revenue,
             COUNT(*) as bookings_count
      FROM bookings b
      WHERE b.payment_status = 'paid'
    `;
    const params = [];
    if (date_from) { sql += ` AND b.booking_date >= ?`; params.push(date_from); }
    if (date_to) { sql += ` AND b.booking_date <= ?`; params.push(date_to); }
    sql += ` GROUP BY ${groupBy} ORDER BY period DESC LIMIT 60`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Revenue report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate revenue report.' });
  }
});

// GET /api/admin/reports/bookings?date_from=&date_to=
router.get('/reports/bookings', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `
      SELECT b.booking_date as period,
             COUNT(*) as total,
             SUM(b.status = 'confirmed') as confirmed,
             SUM(b.status = 'cancelled') as cancelled,
             SUM(b.status = 'completed') as completed,
             SUM(b.status = 'pending') as pending
      FROM bookings b WHERE 1=1
    `;
    const params = [];
    if (date_from) { sql += ` AND b.booking_date >= ?`; params.push(date_from); }
    if (date_to) { sql += ` AND b.booking_date <= ?`; params.push(date_to); }
    sql += ` GROUP BY b.booking_date ORDER BY period DESC LIMIT 60`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Bookings report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate bookings report.' });
  }
});

// GET /api/admin/reports/occupancy?date_from=&date_to=
router.get('/reports/occupancy', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const result = await query(
      `SELECT f.name as facility_name, f.category, f.total_units,
              COUNT(b.id) as total_bookings,
              IFNULL(SUM(b.total_amount), 0) as revenue,
              ROUND(COUNT(b.id) / GREATEST(f.total_units, 1) * 100, 1) as occupancy_rate
       FROM facilities f
       LEFT JOIN bookings b ON f.id = b.facility_id
         AND b.payment_status = 'paid'
         AND (? IS NULL OR b.booking_date >= ?)
         AND (? IS NULL OR b.booking_date <= ?)
       WHERE f.is_active = 1
       GROUP BY f.id, f.name, f.category, f.total_units
       ORDER BY total_bookings DESC`,
      [date_from || null, date_from || null, date_to || null, date_to || null]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Occupancy report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate occupancy report.' });
  }
});

// GET /api/admin/reports/facility-usage
router.get('/reports/facility-usage', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = `
      SELECT f.name as facility_name, f.category,
             COUNT(b.id) as bookings_count,
             IFNULL(SUM(b.total_amount), 0) as total_revenue,
             AVG(b.total_amount) as avg_booking_value
      FROM facilities f
      LEFT JOIN bookings b ON f.id = b.facility_id AND b.status != 'cancelled'
    `;
    const params = [];
    const conditions = [];
    if (date_from) { conditions.push(`b.booking_date >= ?`); params.push(date_from); }
    if (date_to) { conditions.push(`b.booking_date <= ?`); params.push(date_to); }
    if (conditions.length) sql += ` AND ` + conditions.join(' AND ');
    sql += ` GROUP BY f.id, f.name, f.category ORDER BY bookings_count DESC`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Facility usage report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate facility usage report.' });
  }
});

module.exports = router;
