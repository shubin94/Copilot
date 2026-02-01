# Production Smoke Checklist

Minimal checklist to verify production readiness. Run with `NODE_ENV=production`.

---

## 1. Server starts with no warnings

- [ ] `NODE_ENV=production npm start` completes successfully
- [ ] Console shows no warnings or errors during startup
- [ ] Logs show: `✅ Server started successfully`

---

## 2. Database connection and validation

- [ ] `validateDatabase()` runs and passes (no thrown errors)
- [ ] Required tables exist: `app_secrets`, `app_policies`, `site_settings`
- [ ] `app_policies` has required keys (pagination, visibility, post_approval, pricing)
- [ ] `site_settings` has at least one row

---

## 3. Login with email/password

- [ ] Visit `/login`
- [ ] Enter valid email and password
- [ ] Submit form → redirect to dashboard or home
- [ ] Session persists (refresh page, user remains logged in)

---

## 4. Google OAuth (if enabled)

- [ ] Visit `/login`
- [ ] Click "Continue with Google"
- [ ] Complete Google consent flow
- [ ] Redirected back to app, logged in
- [ ] Session persists

*If Google OAuth is disabled (no `google_client_id`), skip this item.*

---

## 5. Creating an order

- [ ] Log in as detective
- [ ] Navigate to a service (own or another detective's)
- [ ] Add to order / initiate order flow
- [ ] Order creation completes (order appears in history or confirmation)
- [ ] No 500 errors in console or network

---

## 6. Payment intent creation

- [ ] As detective, initiate subscription upgrade (paid plan)
- [ ] Payment UI appears (Razorpay/PayPal checkout)
- [ ] Order/intent is created; user is not auto-charged
- [ ] User can cancel or complete payment flow manually

*Verify payment *intent* creation only. Do NOT auto-complete a real charge.*

---

## 7. Disabled payment gateway hidden in UI

- [ ] Disable a gateway in Admin → Payment Gateways (e.g. PayPal)
- [ ] Visit detective subscription page
- [ ] Disabled gateway does NOT appear as an option
- [ ] Only enabled gateway(s) shown

---

## 8. Basic CMS page loads

- [ ] Ensure at least one published CMS page exists (Admin → CMS)
- [ ] Visit `/blog/<page-slug>` or equivalent CMS route
- [ ] Page loads without 404 or 500
- [ ] Content renders correctly

---

## Quick reference

| # | Check                    | Pass criteria                          |
|---|--------------------------|----------------------------------------|
| 1 | Server start             | No warnings, clean startup             |
| 2 | Database                 | validateDatabase() passes              |
| 3 | Email/password login     | Login and session work                 |
| 4 | Google OAuth             | Full roundtrip (if enabled)            |
| 5 | Order creation           | Order created successfully             |
| 6 | Payment intent           | Intent created, no auto-charge         |
| 7 | Disabled gateway         | Not shown in UI                        |
| 8 | CMS page                 | Public page loads                      |
