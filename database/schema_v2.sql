-- Mamagan Fun & Adventure Beach Resort Booking System Schema (v2 - facility metadata)
-- NOTE: Manual migration recommended. This file creates missing columns/tables if you run it on a fresh DB.

-- MySQL (Aiven compatible)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    auth_provider VARCHAR(50) DEFAULT 'local',
    provider_id VARCHAR(255),
    role VARCHAR(50) DEFAULT 'guest',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_provider (auth_provider, provider_id)
);

-- 2. Resorts Table
CREATE TABLE IF NOT EXISTS resorts (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    images JSON,
    amenities JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Facilities Table
CREATE TABLE IF NOT EXISTS facilities (
    id CHAR(36) PRIMARY KEY,
    resort_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    -- category: cottage | room_cabana | beach_equipment
    category VARCHAR(50) NOT NULL DEFAULT 'cottage',
    -- size: small | medium | large | extra_large (cottages/cabanas only)
    size VARCHAR(50) NULL,

    -- day/night pricing
    -- for day range: we store min/max, and by default frontend/backend will charge max
    price_day_min DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_day_max DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- nightly add-on rule (defaults applied in code; still persisted here)
    -- night_add_mode: fixed_per_person | fixed_per_booking
    night_add_mode VARCHAR(50) NOT NULL DEFAULT 'fixed_per_person',
    -- night_add_value is the add-on amount (PHP)
    night_add_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    -- night_add_threshold_pax is pax threshold that switches to the "high" tier
    night_add_threshold_pax INT NOT NULL DEFAULT 6,
    night_add_value_high DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- legacy type/status kept for compatibility
    type VARCHAR(100) NOT NULL DEFAULT 'cabana',
    description TEXT,
    images JSON,

    -- beach equipment rental rates
    hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- capacity/pax fit and inventory units
    capacity INT DEFAULT 1,
    total_units INT NOT NULL DEFAULT 1,

    -- status/activation
    is_active BOOLEAN DEFAULT TRUE,

    -- rule flag for "cannot be rented on pick hours"
    -- if false, client should not show time-slot selection and booking should be daily-only
    allow_time_slots BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE
);

-- 4. Availability Table
CREATE TABLE IF NOT EXISTS availability (
    id CHAR(36) PRIMARY KEY,
    facility_id CHAR(36) NOT NULL,
    date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    available INT NOT NULL DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_reason VARCHAR(255),
    UNIQUE KEY unique_avail (facility_id, date, time_slot),
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- 5. Promos Table
CREATE TABLE IF NOT EXISTS promos (
    id CHAR(36) PRIMARY KEY,
    code VARCHAR(100) UNIQUE,
    discount_type VARCHAR(50) NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    valid_from DATE,
    valid_until DATE,
    applicable_facility_types JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    facility_id CHAR(36) NOT NULL,
    promo_id CHAR(36),
    booking_date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    qr_code TEXT,
    checked_in_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    FOREIGN KEY (promo_id) REFERENCES promos(id),
    INDEX idx_bookings_user_id (user_id),
    INDEX idx_bookings_facility_id (facility_id),
    INDEX idx_bookings_date (booking_date),
    INDEX idx_bookings_status (status)
);

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) PRIMARY KEY,
    booking_id CHAR(36) NOT NULL,
    paymongo_intent_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    paid_at DATETIME,
    webhook_data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    INDEX idx_payments_booking_id (booking_id)
);

-- 8. Blocked Dates Table
CREATE TABLE IF NOT EXISTS blocked_dates (
    id CHAR(36) PRIMARY KEY,
    facility_id CHAR(36),
    resort_id CHAR(36),
    block_date DATE NOT NULL,
    reason VARCHAR(255),
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

