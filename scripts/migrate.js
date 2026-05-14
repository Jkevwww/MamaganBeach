/**
 * Safe migration script – adds missing columns and tables without destroying existing data.
 * Run: node scripts/migrate.js   OR   npm run db:migrate
 */
require('dotenv').config();
const { pool } = require('../config/database');

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].cnt > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].cnt > 0;
}

async function addColumnIfMissing(conn, table, column, definition) {
  if (!(await columnExists(conn, table, column))) {
    await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`  ✓ Added ${table}.${column}`);
  } else {
    console.log(`  · ${table}.${column} already exists`);
  }
}

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('\n=== Mamagan Beach Resort – Database Migration v3 ===\n');

    // ─── facilities ───────────────────────────────────────────────────────────
    console.log('── facilities table ──');
    await addColumnIfMissing(conn, 'facilities', 'capacity_min',  'INT NOT NULL DEFAULT 1');
    await addColumnIfMissing(conn, 'facilities', 'capacity_max',  'INT NOT NULL DEFAULT 30');
    await addColumnIfMissing(conn, 'facilities', 'bookable',      'BOOLEAN NOT NULL DEFAULT TRUE');
    await addColumnIfMissing(conn, 'facilities', 'unavailable_reason', 'VARCHAR(500) NULL');
    await addColumnIfMissing(conn, 'facilities', 'restricted_during_peak_hours', 'BOOLEAN NOT NULL DEFAULT FALSE');
    await addColumnIfMissing(conn, 'facilities', 'base_price',    'DECIMAL(10,2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(conn, 'facilities', 'images_link',   'TEXT NULL');
    await addColumnIfMissing(conn, 'facilities', 'updated_at',    'DATETIME NULL ON UPDATE CURRENT_TIMESTAMP');

    // ─── bookings ─────────────────────────────────────────────────────────────
    console.log('── bookings table ──');
    await addColumnIfMissing(conn, 'bookings', 'rejection_reason', 'TEXT NULL');
    await addColumnIfMissing(conn, 'bookings', 'admin_note',       'TEXT NULL');
    await addColumnIfMissing(conn, 'bookings', 'guest_count',      'INT NOT NULL DEFAULT 1');
    await addColumnIfMissing(conn, 'bookings', 'booking_type',     "VARCHAR(20) NOT NULL DEFAULT 'day'");

    // ─── payments ─────────────────────────────────────────────────────────────
    console.log('── payments table ──');
    await addColumnIfMissing(conn, 'payments', 'gcash_ref_no',       'VARCHAR(100) NULL');
    await addColumnIfMissing(conn, 'payments', 'gcash_audit_status', "VARCHAR(20) NOT NULL DEFAULT 'pending'");
    await addColumnIfMissing(conn, 'payments', 'gcash_audit_note',   'TEXT NULL');
    await addColumnIfMissing(conn, 'payments', 'gcash_audited_by',   'CHAR(36) NULL');
    await addColumnIfMissing(conn, 'payments', 'gcash_audited_at',   'DATETIME NULL');
    await addColumnIfMissing(conn, 'payments', 'updated_at',         'DATETIME NULL ON UPDATE CURRENT_TIMESTAMP');

    // ─── promos ───────────────────────────────────────────────────────────────
    console.log('── promos table ──');
    await addColumnIfMissing(conn, 'promos', 'title',       'VARCHAR(255) NULL');
    await addColumnIfMissing(conn, 'promos', 'description', 'TEXT NULL');
    await addColumnIfMissing(conn, 'promos', 'applies_to',  "VARCHAR(20) NOT NULL DEFAULT 'all'");
    await addColumnIfMissing(conn, 'promos', 'updated_at',  'DATETIME NULL ON UPDATE CURRENT_TIMESTAMP');

    // ─── users ────────────────────────────────────────────────────────────────
    console.log('── users table ──');
    await addColumnIfMissing(conn, 'users', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');

    // ─── system_logs (new table) ──────────────────────────────────────────────
    console.log('── system_logs table ──');
    if (!(await tableExists(conn, 'system_logs'))) {
      await conn.execute(`
        CREATE TABLE system_logs (
          id          CHAR(36) PRIMARY KEY,
          user_id     CHAR(36) NULL,
          user_name   VARCHAR(255) NULL,
          user_role   VARCHAR(50) NULL,
          action      VARCHAR(100) NOT NULL,
          module      VARCHAR(50) NOT NULL,
          target_type VARCHAR(50) NULL,
          target_id   VARCHAR(100) NULL,
          details     TEXT NULL,
          ip_address  VARCHAR(45) NULL,
          user_agent  TEXT NULL,
          created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_logs_user (user_id),
          INDEX idx_logs_module (module),
          INDEX idx_logs_action (action),
          INDEX idx_logs_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✓ Created system_logs table');
    } else {
      console.log('  · system_logs already exists');
    }

    // ─── blackout_periods (new table, replaces blocked_dates) ─────────────────
    console.log('── blackout_periods table ──');
    if (!(await tableExists(conn, 'blackout_periods'))) {
      await conn.execute(`
        CREATE TABLE blackout_periods (
          id          CHAR(36) PRIMARY KEY,
          facility_id CHAR(36) NULL,
          category    VARCHAR(50) NULL,
          block_date  DATE NOT NULL,
          start_time  TIME NULL,
          end_time    TIME NULL,
          reason      VARCHAR(500) NULL,
          is_active   BOOLEAN NOT NULL DEFAULT TRUE,
          created_by  CHAR(36) NULL,
          created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at  DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_blackout_date (block_date),
          INDEX idx_blackout_facility (facility_id),
          INDEX idx_blackout_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✓ Created blackout_periods table');
    } else {
      console.log('  · blackout_periods already exists');
    }

    // ─── peak_hours (new table) ───────────────────────────────────────────────
    console.log('── peak_hours table ──');
    if (!(await tableExists(conn, 'peak_hours'))) {
      await conn.execute(`
        CREATE TABLE peak_hours (
          id          CHAR(36) PRIMARY KEY,
          facility_id CHAR(36) NULL,
          category    VARCHAR(50) NULL,
          start_time  TIME NOT NULL,
          end_time    TIME NOT NULL,
          is_active   BOOLEAN NOT NULL DEFAULT TRUE,
          reason      VARCHAR(255) NULL,
          created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // Seed default peak hours for beach equipment
      const { v4: uuidv4 } = require('uuid');
      await conn.execute(
        `INSERT INTO peak_hours (id, category, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), 'beach_equipment', '06:00:00', '11:00:00', 'Morning peak hours – equipment restricted']
      );
      console.log('  ✓ Created peak_hours table + seeded default peak hours');
    } else {
      console.log('  · peak_hours already exists');
    }

    console.log('\n=== Migration complete ===\n');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
