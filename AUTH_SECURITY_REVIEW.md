# Authentication & Authorization Security Review

**Date:** 2026-01-31  
**Scope:** Password handling, PII in logs, login/signup/password-reset security, rate limiting, session/token handling, HTTP status codes and error messages. Security and production-readiness only; business logic unchanged.

---

## 1. Password handling (verified)

| Area | Status | Details |
|------|--------|--------|
| **Hashing** | OK | `bcrypt.hash(..., 10)` (SALT_ROUNDS = 10) in `storage.createUser`, `storage.setUserPassword`, `storage.resetDetectivePassword`; applications use `bcrypt.hash(..., 10)` before storing. |
| **Comparison** | OK | `bcrypt.compare(plain, stored)` for login, change-password, admin check-password, application login. No timing-leak mitigation beyond bcrypt. |
| **Storage** | OK | Passwords stored only as hashes. `createUserFromHashed` used for pre-hashed (e.g. application approval); no plaintext persistence. |
| **Response** | OK | Password never returned: `const { password: _p, ...userWithoutPassword }` (or equivalent) before sending user object. |

No changes made to password logic.

---

## 2. PII in logs (fixed)

**Removed or redacted:**

- **Login/auth:** Already generic: `[auth] Login failed: invalid credentials` (no email/userId).
- **Claim flow:** All Claim logs that included email or identifiers were made generic:
  - `[Claim] Sent invitation email to ${application.email}` → `[Claim] Sent invitation email`
  - `[Claim] Account claimed successfully: ... (${email})` → `[Claim] Account claimed successfully`
  - `[Claim] Login already enabled for: ${email}` → `[Claim] Login already enabled`
  - `[Claim] Credentials generated for: ${email}` → `[Claim] Credentials generated`
  - `[Claim] Temporary password email sent to: ${email}` → `[Claim] Temporary password email sent`
  - `[Claim] User email updated to: ${claimedEmail}` → `[Claim] User email updated`
  - `[Claim] Finalization confirmation email sent to: ${claimedEmail}` → `[Claim] Finalization confirmation email sent`
  - `[Claim] Email already in use: ${claimedEmail}` → `[Claim] Email already in use`
  - `[Claim] Claim finalized for: ${detective.businessName}` → `[Claim] Claim finalized`
  - `[Claim] Cleaned up claim tokens for detective: ${detective.id}` → `[Claim] Cleaned up claim tokens`
  - `[Claim] User not found for detective: ${detective.id}` → `[Claim] User not found for detective`
- **Payment/detective errors:** userId and order IDs removed from error logs:
  - `[upgrade-plan] Detective not found for userId: ...` → `[upgrade-plan] Detective not found`
  - `[create-order] Detective not found for userId: ...` → `[create-order] Detective not found`
  - `[verify] Forbidden: User ${userId} does not own order ...` → `[verify] Forbidden: user does not own order`
  - `[paypal-create-order] Detective not found for userId: ...` → `[paypal-create-order] Detective not found`
  - `[paypal-capture] Forbidden: User ${userId} does not own order ...` → `[paypal-capture] Forbidden: user does not own order`
  - `[blue-tick-order] Detective not found for userId: ...` → `[blue-tick-order] Detective not found`
  - `[verify-blue-tick] Detective not found for user ${userId}` → `[verify-blue-tick] Detective not found`

No email, phone, or userId is logged in auth or claim flows.

---

## 3. Login, signup, password-reset endpoints

| Endpoint | Security measures |
|----------|-------------------|
| **POST /api/auth/register** | Zod validation; duplicate email returns generic "Registration failed" (no user enumeration); session regenerate on success; password hashed in storage; no PII in error logs. |
| **POST /api/auth/login** | Email/password required (400); generic "Invalid email or password" (401) on failure; session regenerate on success; bcrypt.compare; no PII in logs. |
| **POST /api/auth/change-password** | requireAuth; current + new password validated; bcrypt.compare; generic error messages; no PII in logs. |
| **POST /api/auth/set-password** | requireAuth; mustChangePassword check; new password length; generic errors; no PII in logs. |
| **POST /api/auth/logout** | Session destroy; clearCookie with path, httpOnly, secure, sameSite to match session cookie. |
| **POST /api/admin/detectives/:id/reset-password** | requireRole("admin"); temp password hashed; generic error log. |
| **Password reset (forgot)** | Intentionally disabled in UI; no public reset endpoint. |

No business logic changed; only security and logging tightened.

---

## 4. Rate limiting (fixed)

- **Before:** Auth rate limiter applied only in production (`if (config.env.isProd) { app.use("/api/auth/", authLimiter); }`).
- **After:** Auth rate limiter applied in all environments: `app.use("/api/auth/", authLimiter)`.
- **Config:** `config.rateLimit.windowMs` (default 15 min), `config.rateLimit.max` (prod 100, dev 1000); `skipSuccessfulRequests: true` so only failed attempts count.

All auth-related routes under `/api/auth/` are now rate-limited in every environment.

---

## 5. Session and token handling

| Item | Status |
|------|--------|
| **Session store** | express-session with PostgreSQL (or MemoryStore in dev); connect-pg-simple. |
| **Cookie** | httpOnly: true, secure in prod, sameSite: "lax", maxAge from config. |
| **Session secret** | Required in prod (requireEnv("SESSION_SECRET")); dev fallback. |
| **Regenerate** | Session regenerated on login and register (fixation prevention). |
| **Destroy** | Session destroyed on logout; cookie cleared with path, httpOnly, secure, sameSite to match. |
| **CSRF** | Origin/referer check; X-Requested-With: XMLHttpRequest; x-csrf-token matched to session; GET /api/csrf-token to obtain token. |
| **JWT** | Not used; session-only auth. |

No changes to session or CSRF logic beyond logout cookie clearing.

---

## 6. HTTP status codes and error messages

| Scenario | Status | Message |
|----------|--------|--------|
| Login: missing email/password | 400 | "Email and password are required" |
| Login: user not found / wrong password | 401 | "Invalid email or password" |
| Login: bcrypt error | 401 | "Invalid email or password" |
| Register: duplicate email | 400 | "Registration failed" |
| Change password: wrong current | 400 | "Current password is incorrect" |
| Set password: not required | 400 | "Password change not required" |
| Unauthenticated | 401 | "Unauthorized - Please log in" |
| Forbidden (role) | 403 | "Forbidden - Insufficient permissions" |

All auth failure responses are generic; no user enumeration or sensitive detail in responses.

---

## 7. Files changed

| File | Changes |
|------|--------|
| **server/app.ts** | Auth rate limiter applied in all environments (removed `if (config.env.isProd)`). |
| **server/routes.ts** | Registration: duplicate-email message set to "Registration failed". Logout: clearCookie with path, httpOnly, secure, sameSite. Claim and payment/detective logs: all PII (email, userId, detective.id, order ids) removed or replaced with generic messages. |

Auth error logging was already generic (e.g. `[auth] Login failed`, `[auth] Session error`, `[auth] Change password failed`); no further changes there.

---

## Summary

- **Password handling:** Verified; hashing (bcrypt 10 rounds), comparison, and storage are correct; password never in responses.
- **PII in logs:** Removed from login, registration, claim, and payment/detective logs.
- **Auth endpoints:** Validated; rate limiting, generic errors, and session handling aligned with good practice.
- **Rate limiting:** Applied to `/api/auth/` in all environments.
- **Session/cookies:** Confirmed; logout cookie clearing updated to match session cookie options.
- **Status codes and messages:** 400/401/403/500 with generic messages; no business logic changed.

Auth security review complete. No business logic changes; security and production-readiness only.
