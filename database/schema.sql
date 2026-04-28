-- Mamagan Fun & Adventure Beach Resort Booking System Schema
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
    type VARCHAR(100) NOT NULL,
    description TEXT,
    images JSON,
    base_price DECIMAL(10,2) NOT NULL,
    capacity INT DEFAULT 1,
    total_units INT NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
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

