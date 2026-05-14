/**
 * Seed facilities with real Mamagan Beach Resort data.
 * Run: node scripts/seed-facilities.js   OR   npm run db:seed-facilities
 *
 * Safe: only inserts if no facility with the same name + category already exists.
 */
require('dotenv').config();
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const FACILITIES = [
  // ── CATEGORY: COTTAGES ─────────────────────────────────────────────────────
  {
    name: 'Small Cottage',
    category: 'cottage',
    description: 'Cozy small cottage perfect for small groups. Shaded and near the beach.',
    capacity_min: 2,
    capacity_max: 10,
    total_units: 5,
    base_price: 500.00,
    bookable: true,
    images_link: null,
  },
  {
    name: 'Medium Cottage',
    category: 'cottage',
    description: 'Comfortable medium cottage. Currently undergoing renovation.',
    capacity_min: 5,
    capacity_max: 15,
    total_units: 0,
    base_price: 800.00,
    bookable: false,
    unavailable_reason: 'Currently under renovation – check back soon.',
    images_link: null,
  },
  {
    name: 'Large Cottage',
    category: 'cottage',
    description: 'Spacious large cottage great for family reunions and group outings.',
    capacity_min: 10,
    capacity_max: 20,
    total_units: 4,
    base_price: 1000.00,
    bookable: true,
    images_link: null,
  },
  {
    name: 'Extra Large Cottage',
    category: 'cottage',
    description: 'Our biggest cottage — ideal for large group gatherings and events.',
    capacity_min: 15,
    capacity_max: 30,
    total_units: 1,
    base_price: 2000.00,
    bookable: true,
    images_link: null,
  },

  // ── CATEGORY: CABANAS ──────────────────────────────────────────────────────
  {
    name: 'Small Cabana',
    category: 'cabana',
    description: 'Enclosed small cabana with privacy, suitable for couples and small families.',
    capacity_min: 2,
    capacity_max: 6,
    total_units: 2,
    base_price: 1200.00,
    bookable: true,
    images_link: null,
  },
  {
    name: 'Medium Cabana',
    category: 'cabana',
    description: 'Spacious medium cabana with full amenities for medium-sized groups.',
    capacity_min: 6,
    capacity_max: 8,
    total_units: 4,
    base_price: 1700.00,
    bookable: true,
    images_link: null,
  },
  {
    name: 'Large Cabana',
    category: 'cabana',
    description: 'Premium large cabana with panoramic beach view, up to 12 guests.',
    capacity_min: 8,
    capacity_max: 12,
    total_units: 1,
    base_price: 3000.00,
    bookable: true,
    images_link: null,
  },
  {
    name: 'Extra Large Cabana',
    category: 'cabana',
    description: 'Our flagship cabana accommodating up to 30 guests — perfect for events.',
    capacity_min: 25,
    capacity_max: 30,
    total_units: 1,
    base_price: 6000.00,
    bookable: true,
    images_link: null,
  },

  // ── CATEGORY: BEACH EQUIPMENT ──────────────────────────────────────────────
  {
    name: 'Life Vest',
    category: 'beach_equipment',
    description: 'Certified life vests for water safety. Required for non-swimmers.',
    capacity_min: 1,
    capacity_max: 1,
    total_units: 30,
    base_price: 100.00,
    bookable: true,
    restricted_during_peak_hours: true,
    images_link: null,
  },
  {
    name: 'Boat',
    category: 'beach_equipment',
    description: 'Motor boat for island hopping and scenic tours around the cove.',
    capacity_min: 2,
    capacity_max: 8,
    total_units: 3,
    base_price: 500.00,
    bookable: true,
    restricted_during_peak_hours: true,
    images_link: null,
  },
  {
    name: 'Stand Up Paddle Board',
    category: 'beach_equipment',
    description: 'Stand up paddle boards for a fun workout on the water.',
    capacity_min: 1,
    capacity_max: 1,
    total_units: 8,
    base_price: 100.00,
    bookable: true,
    restricted_during_peak_hours: true,
    images_link: null,
  },
];

async function facilityExists(conn, name, category) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM facilities WHERE name = ? AND category = ?`,
    [name, category]
  );
  return rows[0].cnt > 0;
}

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('\n=== Mamagan Beach Resort – Facility Seeder ===\n');

    let inserted = 0;
    let skipped = 0;

    for (const f of FACILITIES) {
      const exists = await facilityExists(conn, f.name, f.category);
      if (exists) {
        console.log(`  · SKIP  "${f.name}" (${f.category}) – already exists`);
        skipped++;
        continue;
      }

      const id = uuidv4();
      await conn.execute(
        `INSERT INTO facilities
           (id, name, category, description, capacity_min, capacity_max, total_units,
            base_price, bookable, unavailable_reason, restricted_during_peak_hours, images_link,
            is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
        [
          id,
          f.name,
          f.category,
          f.description || null,
          f.capacity_min ?? 1,
          f.capacity_max ?? 30,
          f.total_units ?? 1,
          f.base_price ?? 0,
          f.bookable ? 1 : 0,
          f.unavailable_reason || null,
          f.restricted_during_peak_hours ? 1 : 0,
          f.images_link || null,
        ]
      );
      console.log(`  ✓ INSERT "${f.name}" (${f.category}) — ₱${f.base_price}`);
      inserted++;
    }

    console.log(`\n=== Done: ${inserted} inserted, ${skipped} skipped ===\n`);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
