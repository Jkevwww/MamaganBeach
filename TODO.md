# File Review & Fix Progress

## Plan Approved - Steps to Complete

- [ ] 1. Fix `public/index.html` — missing closing `</div>` tags (Features, Facilities skeleton, Footer, JS template)
- [ ] 2. Fix `services/emailService.js` — missing `</div>` in email HTML
- [ ] 3. Fix `public/js/admin.js` — rename/remove duplicate `requireAdmin()`
- [ ] 4. Fix `routes/payments.js` — add paid guard in simulate-success; add webhook signature verification
- [ ] 5. Fix `utils/validators.js` — change `'grabpay'` → `'grab_pay'`
- [x] 6. Fix `public/js/auth.js` — null-safe fallback for `user.full_name`
- [ ] 7. Fix `routes/bookings.js` — wrap booking creation + availability in DB transaction
- [ ] 8. Fix `scripts/init-db.js` — improve SQL splitting robustness

