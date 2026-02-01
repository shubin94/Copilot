# Security Audit Report — Read-Only, In-Depth

**Date:** 2025-01-30  
**Scope:** Full codebase (server, client, shared, config).  
**Rules:** No code modified; audit only. No fixes proposed unless vulnerability confirmed.

---

## 1. Executive Summary

The application implements solid baseline security: session-based auth with httpOnly/secure/sameSite cookies, CSRF protection via synchronizer token plus origin/referer and X-Requested-With, role-based access (admin/detective/user), and payment flows that use server-authoritative amounts and Razorpay signature verification. **No critical or high-severity vulnerabilities were identified.** Several medium and low items were found: possible session fixation (no session regeneration on login), payment verify replay allowing subscription re-application without idempotency check, unauthenticated user profile by ID, and a few patterns to harden (SQL interpolation pattern, temp password RNG, production CSRF origin config). The app is **suitable for production launch** assuming: (1) production env has `CSRF_ALLOWED_ORIGINS` set to the app origin(s), (2) session fixation and payment replay are accepted as medium risks or will be addressed in a follow-up, and (3) secrets and dependencies are kept up to date.

---

## 2. Findings by Severity

### Critical  
**None.**

---

### High  
**None.**

---

### Medium

#### M1. Session fixation (no regeneration on login)

- **Description:** On login and register, the server sets `req.session.userId`, `req.session.userRole`, and `req.session.csrfToken` on the **existing** session. It does not call `req.session.regenerate()`. If an attacker can fixate a session (e.g. lure victim to a page that sets a known session cookie, or use a subdomain/path issue), and the victim then logs in, the attacker’s session ID becomes an authenticated session.
- **Affected:** `server/routes.ts` — `POST /api/auth/login` (lines ~536–539), `POST /api/auth/register` (lines ~470–472).
- **Exploitability:** Realistic where an attacker can set or influence the victim’s session cookie before login (e.g. same-site attacker page, misconfiguration, or XSS elsewhere). Requires attacker to obtain the fixed session ID after victim logs in (e.g. via log/side-channel or cookie theft).
- **Evidence:** Login/register assign session fields but do not call `session.regenerate()`; logout correctly uses `session.destroy()` and `res.clearCookie("connect.sid")`.

---

#### M2. Payment verify replay (Razorpay) — no idempotency for already-paid orders

- **Description:** `POST /api/payments/verify` and `POST /api/payments/verify-blue-tick` do not check whether the payment order is already `status === "paid"`. After signature and ownership checks, they always call `markPaymentOrderPaid` and then update the detective (subscription/Blue Tick). Replaying the same verify request (same `razorpay_order_id`/payment_id/signature) re-runs the upgrade logic: `subscriptionActivatedAt` and `subscriptionExpiresAt` are recalculated from “now”, so replay can effectively extend subscription without a second payment.
- **Affected:** `server/routes.ts` — verify flow (~1227–1302), verify-blue-tick flow (~1893–1960); `server/storage.ts` — `markPaymentOrderPaid` (no guard on current status).
- **Exploitability:** Realistic for a user who completed one payment: they (or an attacker with the same session) can replay the verify request to extend subscription. PayPal capture is different: capture is done server-side via SDK; re-capture of an already-captured order would fail at the PayPal API, so PayPal flow is not similarly vulnerable.
- **Note:** No change was made; fix would be to skip upgrade when `paymentOrder.status === "paid"` (return success without re-applying).

---

#### M3. Unauthenticated user profile by ID

- **Description:** `GET /api/users/:id` has no authentication. It returns the user record (with password stripped) for any valid user ID: email, name, role, and other profile fields. This allows enumeration and disclosure of user profiles by ID (e.g. if IDs are predictable or leaked elsewhere).
- **Affected:** `server/routes.ts` — `GET /api/users/:id` (lines ~2178–2191).
- **Exploitability:** Realistic for enumeration if user IDs are guessable or discoverable (e.g. sequential, or exposed in other responses). UUIDs reduce guessability but do not remove the issue of unauthenticated access to profile data.
- **Note:** If this endpoint is intentional (e.g. public profile by ID), consider returning only a minimal public subset (e.g. display name, avatar) and protecting the rest behind auth.

---

### Low

#### L1. SQL interpolation in ranking (bad pattern; data is internal)

- **Description:** In `server/ranking.ts`, `sql.raw(\`ARRAY[${serviceIds.map((id) => \`'${id}'\`).join(",")}]\`)` builds a SQL fragment via string interpolation. The `serviceIds` are detective service IDs from the database (internal), not user input, so this is not a direct SQL injection vector. The pattern is still unsafe if the code were ever refactored to use user-controlled IDs.
- **Affected:** `server/ranking.ts` (lines ~177–179).
- **Exploitability:** Theoretical for current code (internal data only). Risk increases if IDs ever become user-influenced.
- **Recommendation:** Use parameterized queries or a safe array binding (e.g. `= ANY($1::text[])` with a parameter) instead of `sql.raw` and string interpolation.

---

#### L2. Temporary password uses non-cryptographic RNG

- **Description:** `generateTempPassword()` in `server/services/claimTokenService.ts` uses `Math.random()` for character selection. Temporary passwords are emailed and must be changed on first login; they are not long-term secrets. Still, `Math.random()` is not cryptographically secure.
- **Affected:** `server/services/claimTokenService.ts` — `generateTempPassword()` (lines ~82–111).
- **Exploitability:** Low; temp passwords are single-use and forced change, but predictability is higher than with `crypto.randomBytes()`.
- **Recommendation:** Use `crypto.randomBytes()` (or equivalent) for generating temp password characters.

---

#### L3. Supabase upload — user-controlled Content-Type from data URL

- **Description:** `uploadDataUrl()` in `server/supabase.ts` derives `contentType` from the data URL (`data:<contentType>;base64,...`). The file path is server-generated (e.g. `logos/${Date.now()}-${Math.random()}.png`). Stored objects are served with the user-chosen Content-Type, which could in theory be set to a type that triggers execution (e.g. if Supabase or a CDN serves with that type). Path is not user-controlled, so path traversal was not in scope.
- **Affected:** `server/supabase.ts` — `uploadDataUrl()` (lines ~45–59).
- **Exploitability:** Low; impact depends on storage/CDN behavior and whether any uploaded URL is ever executed. Restricting allowed content types (e.g. images and PDF only) would reduce risk.

---

### Informational

#### I1. Production CSRF allowed origins

- **Description:** In production, `config.csrf.allowedOrigins` is `getStringList("CSRF_ALLOWED_ORIGINS", [])`, so it defaults to an empty array. The CSRF middleware rejects requests whose origin/referer is not in the list. If `CSRF_ALLOWED_ORIGINS` is not set in production, all cross-origin and some same-origin requests (that send Origin) may receive 403.
- **Affected:** `server/config.ts` (lines ~74–83); `server/app.ts` CSRF middleware.
- **Action:** Ensure production sets `CSRF_ALLOWED_ORIGINS` to the application origin(s) (e.g. `https://askdetectives.com`).

---

#### I2. Admin payment gateways return full config

- **Description:** `GET /api/admin/payment-gateways` and `GET /api/admin/payment-gateways/:id` return gateway rows including `config`, which may contain `clientSecret`, `keySecret`, etc. Access is restricted to `requireRole("admin")`. This is an intentional design choice; ensure admin accounts and sessions are strongly protected.

---

#### I3. Error handler and validation messages

- **Description:** The global error handler in `server/app.ts` sends `err.message` to the client (no stack). Zod validation errors are surfaced via `fromZodError(error).message`, which can include field paths; ensure thrown errors never include secrets or internal details in `message`.

---

#### I4. No payment webhooks

- **Description:** There are no Razorpay or PayPal webhook endpoints. Payment completion is driven only by client-initiated verify/capture. This was confirmed as intentional (see PAYMENT_WEBHOOK_VERIFICATION_REPORT.md).

---

## 3. False Positives / Clarifications

- **Razorpay signature verification:** Uses API `key_secret` with `HMAC-SHA256(order_id|payment_id)`. This is correct for **payment verification** (post-checkout), not for webhooks (which would use a webhook secret and raw body). No vulnerability.
- **PayPal capture:** Server performs capture via SDK; client only sends `paypalOrderId`. No trust of client-provided capture result; capture response is checked. No vulnerability.
- **GET /api/detectives/:id and /api/services/:id:** Public by design (detective/service profiles). No auth required is intentional.
- **ranking.ts sql.raw:** Data source is internal (service IDs from DB). Not user input; no SQL injection in current code. Flagged only as bad pattern (L1).
- **Login/register require CSRF:** Client obtains a token via `GET /api/csrf-token` (session created) then sends it with login/register. Flow is correct; no missing CSRF for these routes.
- **Session cookie settings:** `httpOnly`, `secure` (in prod), `sameSite: "lax"`, `maxAge` set. Appropriate for session cookie.

---

## 4. Intentional Design Decisions

- **No payment webhooks:** Payment state is updated only via browser-initiated verify (Razorpay) or capture (PayPal). No server-to-server webhook handlers.
- **Payment amounts:** Create-order and create PayPal order use packageId/billingCycle from client but **price from server** (DB). Amounts are server-authoritative.
- **Trust proxy:** Set to `1` in production only (`server/app.ts`). Correct for running behind a single reverse proxy.
- **Rate limiting:** Applied only to `/api/auth/` in production. Other routes are not rate-limited in this audit (operational choice).
- **Dev session secret:** Fallback `"dev-session-secret"` when not in production; production requires `SESSION_SECRET`. Acceptable for dev.

---

## 5. Scope Coverage Summary

| Area | Result |
|------|--------|
| **1) Authentication & sessions** | Cookie flags and logout correct; trust proxy correct in prod. **Gap:** No session regeneration on login (M1). |
| **2) Authorization & access control** | Admin routes use `requireRole("admin")`; detective/user routes check ownership (detective profile, reviews, orders, payment orders). **Gap:** GET /api/users/:id unauthenticated (M3). |
| **3) CSRF & request integrity** | Synchronizer token + origin/referer + X-Requested-With; mutation methods protected. Token issued at GET /api/csrf-token and refreshed on login/register. **Gap:** Production must set CSRF_ALLOWED_ORIGINS (I1). |
| **4) Input validation & injection** | Request bodies validated with Zod; SQL uses parameterized queries except ranking.ts (L1). No mass-assignment on sensitive models beyond schema. Supabase path server-generated; content-type from data URL (L3). |
| **5) Payments & financial safety** | Razorpay signature verified with key_secret; PayPal capture server-side; amounts from DB. **Gap:** Verify replay not idempotent (M2). |
| **6) Secrets & environment** | No hardcoded production secrets; sensitive keys redacted in request logging (app.ts). Config requires env in prod for DB, session, Supabase, Razorpay. |
| **7) Error handling & info leakage** | Global handler sends only `message`; no stack to client. Zod messages may include field paths; no evidence of secrets in messages. |
| **8) Dependencies & runtime** | No code changes made; dependency versions and CVEs were not audited. Express/Node usage (helmet, compression, session store) appears standard. |

---

## 6. Final Verdict

- **Is the app safe to launch in production?**  
  **Yes**, with the assumptions below.

- **Assumptions and recommendations:**
  1. **Production configuration:** Set `CSRF_ALLOWED_ORIGINS` to the app origin(s). Ensure `SESSION_SECRET`, `DATABASE_URL`, Supabase and payment gateway env vars are set and not default/dev values.
  2. **Medium risks:** Accept or plan to fix: (a) session fixation (regenerate session on login), (b) payment verify replay (idempotency for already-paid orders), (c) unauthenticated GET /api/users/:id (restrict or remove if not required).
  3. **Operational security:** Protect admin accounts (strong passwords, 2FA if available); restrict access to admin routes and payment gateway config; keep dependencies and Node/runtime patched.
  4. **No critical or high issues** were identified; the findings above are medium, low, or informational.

---

**Audit completed. No code was modified. Fixes were not implemented; await confirmation before any remediation work.**
