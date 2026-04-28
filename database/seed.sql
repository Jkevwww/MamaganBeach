-- Seed Data for Mamagan Fun & Adventure Beach Resort

-- Insert sample resort
INSERT INTO resorts (id, name, description, location, images, amenities) VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Mamagan Fun & Adventure Beach Resort',
    'Experience the ultimate tropical getaway at Mamagan Beach Resort. Nestled along pristine white sands and crystal-clear waters, our resort offers thrilling water sports, relaxing cabanas, and unforgettable island adventures. Perfect for families, couples, and thrill-seekers alike.',
    'Barangay Mamagan, Coastal Road, Philippines',
    '["https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800","https://images.unsplash.com/photo-1571896349842-68c8943b2307?w=800","https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800"]',
    '["Free WiFi","Beachfront","Restaurant","Bar","Water Sports","Parking","Shower Rooms","Safety Deposit"]'
);

-- Insert sample facilities
INSERT INTO facilities (id, resort_id, name, type, description, images, base_price, capacity, total_units) VALUES
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Premium Beach Cabana',
    'cabana',
    'Spacious private cabana with comfortable lounge seating, mini fridge, and dedicated beachfront space. Includes 4 beach towels and a welcome drink.',
    '["https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=800"]',
    2500.00,
    4,
    8
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Deluxe Day Bed',
    'day_bed',
    'Relax in style on our plush day beds with canopy shade. Perfect for sunbathing and enjoying the ocean breeze.',
    '["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800"]',
    1200.00,
    2,
    12
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Jet Ski Rental (30 mins)',
    'jet_ski',
    'Feel the adrenaline rush on our high-performance jet skis. Safety briefing and life vest included. Valid license required.',
    '["https://images.unsplash.com/photo-1584998316204-3b1e405e2e11?w=800"]',
    1800.00,
    2,
    6
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Island Hopping Tour',
    'island_tour',
    'Explore hidden lagoons, snorkel in coral gardens, and visit 3 nearby islands. Includes lunch, snorkel gear, and boat transfers. Duration: 6 hours.',
    '["https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800"]',
    3500.00,
    10,
    4
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Family Cabana Suite',
    'cabana',
    'Large family cabana with dining area, private shower, and premium amenities. Fits up to 8 guests. Includes fruit platter and unlimited iced tea.',
    '["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"]',
    4500.00,
    8,
    4
);

-- Insert sample promos
INSERT INTO promos (id, code, discount_type, discount_value, valid_from, valid_until, applicable_facility_types) VALUES
(
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'BEACH20',
    'percentage',
    20.00,
    CURDATE(),
    DATE_ADD(CURDATE(), INTERVAL 3 MONTH),
    '["cabana","day_bed"]'
),
(
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    'JETFUN',
    'fixed',
    300.00,
    CURDATE(),
    DATE_ADD(CURDATE(), INTERVAL 1 MONTH),
    '["jet_ski"]'
),
(
    'cccccccc-cccc-cccc-cccc-ccccccccccc3',
    'ISLAND15',
    'percentage',
    15.00,
    CURDATE(),
    DATE_ADD(CURDATE(), INTERVAL 2 MONTH),
    '["island_tour"]'
);

-- Seed availability for next 30 days
-- We'll insert a basic set; the init script can generate more if needed
INSERT INTO availability (id, facility_id, date, time_slot, available)
SELECT 
    UUID(),
    f.id,
    d.date_val,
    s.slot,
    f.total_units
FROM facilities f
CROSS JOIN (
    SELECT DATE_ADD(CURDATE(), INTERVAL n DAY) AS date_val
    FROM (
        SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
        UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
        UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
        UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
        UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
        UNION SELECT 30
    ) nums
) d
CROSS JOIN (
    SELECT '08:00-12:00' AS slot
    UNION SELECT '12:00-16:00'
    UNION SELECT '16:00-20:00'
) s;

