# MamaganBeach - Implementation Tracker

## Facilities Reservation & Admin Enhancements

- [x] Step 1: Add DB schema fields for facility category/size and pricing models (ranges + nightly add-ons + equipment hourly/daily rates) (defaults: day-range uses max; night add-on pax<=6 => +200 else +500)
- [ ] Step 2: Update `utils/validators.js` to validate new facility fields (day_range uses max; night add-on default uses pax<=6 => +200 else +500)
- [ ] Step 3: Update backend `routes/facilities.js` CRUD to persist new fields
- [ ] Step 4: Update admin UI (`public/admin/facilities.html` and/or `public/js/assets.js`) to allow editing beach equipment and filtering-ready metadata for cottages/cabanas
- [ ] Step 5: Implement/modify user reservation UI to filter by category, size, price, units (cottage/cabana) and list beach equipment
- [ ] Step 6: Update booking pricing logic in `routes/bookings.js` (night rate add-ons; hourly/daily equipment rules)
- [ ] Step 7: Seed facilities + availability rows for Mamagan’s defined inventory
- [ ] Step 8: Manual testing: filters, availability, booking totals, admin edits

