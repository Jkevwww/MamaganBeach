# Mamagan Beach Resort – Project Memory

## Stack
- Node.js + Express backend, MySQL via mysql2/promise (Aiven SSL)
- DB helper: `const { query } = require('../config/database')` → returns `{ rows }`
- Auth: JWT middleware in `middleware/auth.js` → `authenticateToken`, `requireRole(['admin'])`
- uuid v4 for all PKs (CHAR 36)
- Tailwind CSS (CDN) + custom config at `/public/js/tailwind-config.js`
- `/public/css/style.css` has CSS custom properties, `.card`, `.stat-card`, `.table`, `.btn-primary`, `.btn-outline`, `.form-input`, `.form-label`

## Key Files
- `server.js` — main entry, routes registered here
- `config/database.js` — exports `{ pool, query }`
- `routes/admin.js` — ALL admin CRUD APIs (auth required: admin only)
- `routes/bookings.js` — public + guest booking flow
- `routes/facilities.js` — public facility listing
- `routes/checkin.js` — QR scan checkin → `/api/checkin/verify`
- `routes/settings.js` — profile/password/avatar/email verify → `/api/settings/...`
- `scripts/migrate.js` — safe DB migration (run: `npm run db:migrate`)
- `scripts/seed-facilities.js` — seed facility data (run: `npm run db:seed-facilities`)

## Admin Panel Pages (`/public/admin/`)
- `dashboard.html` — stats (6 cards), revenue line chart, booking status doughnut
- `bookings.html` — table + confirm/reject modals
- `facilities.html` — category tabs + cards + add/edit modal
- `rates.html` — inline price edit per facility + promo CRUD
- `calendar.html` — pure JS month calendar + blackout period CRUD
- `clients.html` — user table + detail modal (enable/disable, change role)
- `logs.html` — system logs table + filters + auto-refresh + clear all
- `reports.html` — Revenue/Bookings/Occupancy/Facility Usage with Chart.js + print
- `checkin.html` — QR scanner → `/api/checkin/verify`
- `settings.html` — profile/photo/password/email verify + system tab

## Client Pages (`/public/`)
- `settings.html` — profile/photo/password/email verify (4 tabs)

## Admin JS Helpers (in every admin page)
- `requireAdmin()` — checks token + role, redirects if not admin
- `renderAdminNav(activePage)` — fills `#admin-nav` sidebar
- `renderAdminNav` active page keys: dashboard, bookings, facilities, rates, calendar, clients, logs, reports, checkin, settings

## API Routes Summary
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/dashboard | Stats + recent bookings + revenue week + bookings by status |
| GET/PATCH | /api/admin/bookings | List/confirm/reject/cancel/delete |
| GET/POST/PUT/DELETE | /api/admin/facilities | CRUD |
| GET/POST/PUT/DELETE/PATCH | /api/admin/promos | CRUD + toggle |
| GET/POST/PUT/DELETE/PATCH | /api/admin/blackouts | Blackout periods CRUD + toggle |
| GET/PATCH | /api/admin/clients | List + update role/is_active |
| GET/DELETE | /api/admin/logs | System logs + clear |
| GET/PATCH | /api/admin/gcash | GCash payment audit approve/reject |
| GET | /api/admin/reports/revenue | Revenue report |
| GET | /api/admin/reports/bookings | Bookings report |
| GET | /api/admin/reports/occupancy | Occupancy report |
| GET | /api/admin/reports/facility-usage | Facility usage report |

## DB Tables (key ones)
- `users`: id, email, full_name, phone, avatar_url, password_hash, role, auth_provider, is_active, created_at
- `facilities`: id, name, category(cottage/cabana/beach_equipment), description, capacity_min, capacity_max, total_units, base_price, bookable, unavailable_reason, restricted_during_peak_hours, images_link, is_active
- `bookings`: id, user_id, facility_id, booking_date, time_slot, quantity, guest_count, booking_type, status, payment_status, total_amount, rejection_reason, admin_note, created_at, updated_at
- `payments`: id, booking_id, amount, gcash_ref_no, gcash_audit_status, gcash_audit_note, gcash_audited_by, gcash_audited_at
- `promos`: id, title, description, discount_type, discount_value, applies_to, valid_from, valid_until, is_active
- `blackout_periods`: id, facility_id, category, block_date, start_time, end_time, reason, is_active, created_by
- `system_logs`: id, user_id, user_name, user_role, action, module, target_type, target_id, details, ip_address, created_at
- `peak_hours`: id, facility_id, category, start_time, end_time, is_active, reason

## Design System
- Primary color: #0891b2 (cyan-600)
- Accent: #f59e0b (amber-500)
- No premium/luxury theming — modern clean minimal
- Font: Inter (body), Poppins (headings via font-heading)
- Status badge pattern: bg-{color}-100 text-{color}-700

## Facility Data (seeded)
- Cottages: Small(5u,₱500), Medium(0u unavailable), Large(4u,₱1000), XL(1u,₱2000)
- Cabanas: Small(2u,₱1200), Medium(4u,₱1700), Large(1u,₱3000), XL(1u,₱6000)
- Beach Equipment: Life Vest(30u,₱100), Boat(3u,₱500), Stand Up Paddle Board(8u,₱100) — all peak-hour restricted

## User Preferences
- Filipino Peso symbol: ₱ (not PHP prefix)
- Locale: en-PH for number formatting
- Admin role only accesses admin panel (no staff role for admin panel in current setup)
