# Smoke Test Report — STEP 1 (Smoke Test)

**Date:** 2026-01-31  
**Scope:** Public, Auth, Detective, Admin flows (report only — no code changes)  
**Evidence:** Terminal server log (run on port 5000), code inspection for disabled flows and errors.

---

## 1. Executive summary

| Result | Description |
|--------|-------------|
| **Overall** | **FAIL** — Core flows fail due to database schema mismatch and one backend bug. |
| **Public** | Partial: home/detectives list OK; service search returns 500. Service card and detective profile untestable when search fails. |
| **Auth** | **PASS**: Login, logout, session (401/304) behave as expected. |
| **Detective** | **FAIL**: Apply/approve flow fails on first approve (500); detective creation succeeds on retry; claim invitation throws server error. |
| **Admin** | **PASS**: Admin CMS (pages, categories, tags) and admin APIs return 200. |

**Root causes:**

- **DB:** Table `public.detectives` is missing columns `blue_tick_addon`, `blue_tick_activated_at`, `has_blue_tick` in the environment that was used. Code and Phase 1 migration expect these columns; they were not applied (or a different DB was used).
- **Backend bug:** In `server/routes.ts` (~3330), claim invitation block uses `user?.id` but `user` is out of scope (declared inside an inner `try`), causing `ReferenceError: user is not defined` when sending claim email after approval.

---

## 2. Passed flows

| # | Flow | Evidence |
|---|------|----------|
| 6 | User login | `POST /api/auth/login 200` |
| 7 | User login (session) | `GET /api/auth/me 304` after login |
| 8 | Logout | `POST /api/auth/logout 200` |
| 9 | Session (unauthenticated) | `GET /api/auth/me 401` when not logged in |
| 1 (partial) | Home page load | Nav/UI loads; `GET /api/detectives 304` and later `GET /api/detectives 200` return detective list when query does not touch `detectives` blue_tick columns |
| 4 (partial) | Detective public profile | `GET /api/detectives/5182df19-... 200`, `GET /api/services/detective/5182df19-... 200` |
| 18 | Admin login | Implied by subsequent admin API 200s |
| 19 | /admin loads | Admin routes served |
| 20 | CMS pages (admin) | `GET /api/admin/pages 200`, `GET /api/admin/categories 200`, `GET /api/admin/tags 200` |
| 21 (partial) | Admin lists | `GET /api/admin/detectives/.../services 200` |
| 23 | Payment gateways page | Route exists (`client/src/pages/admin/payment-gateways.tsx`); page can load (backend may return empty if `payment_gateways` missing; Phase 1 fix3 adds table) |

**Disabled flows (confirmed non-actionable):**

- **Forgot password:** Disabled. `client/src/pages/auth/login.tsx` — button shows toast "Not available yet" and has `title="Not available yet"`. **Confirmed non-actionable.**
- **Delete account (user/detective):** Disabled. `client/src/pages/user/dashboard.tsx` and detective settings — button and confirm action disabled with "Not available yet". **Confirmed non-actionable.**
- **Apply Service Limits (admin):** Disabled. `client/src/pages/admin/subscriptions.tsx` — button disabled, `title="Not available yet"`. **Confirmed no action.**

---

## 3. Failed flows (with exact error)

| # | Flow | Page/route | Action | Console (frontend) | Server error | HTTP |
|---|------|------------|--------|--------------------|--------------|-----|
| 1 (partial) | Home — services | `/` → `/api/services` | Load home / fetch services | — | `column detectives.blue_tick_addon does not exist` (ranking/searchServices) | **500** |
| 2 | Search services | `/search` → `/api/services` | Search (with/without results) | — | Same: `blue_tick_addon` missing in `detectives` | **500** |
| 3 | Open service card | `/search` | N/A (no services returned) | — | Same | — |
| 10–12 | Apply + approve + detective creation | `/admin` → `PATCH /api/applications/:id` | Admin approves application (first time) | — | `column "blue_tick_addon" of relation "detectives" does not exist` (createDetective INSERT) | **500** |
| — | Claim invitation (after approve) | `PATCH /api/applications/:id` | After approval, send claim email | — | `ReferenceError: user is not defined` at `server/routes.ts` ~3330 (`user?.id` used where `user` is out of scope) | — (approval still returns 200 on retry) |

**Error collection (backend):**

- **Postgres:** `error: column "blue_tick_addon" of relation "detectives" does not exist` (code `42703`).  
  Occurrences: `getDetectiveByUserId`, `searchServices`, `getRankedDetectives`, `createDetective`.
- **Node:** `ReferenceError: user is not defined` at `server/routes.ts` (claim invitation block using `user?.id`; `user` is not in scope there).

---

## 4. Unexpected behavior (no crash)

- **Detective creation on retry:** First `PATCH` (approve) returns 500 due to missing `blue_tick_addon`. Second `PATCH` (same application) returns 200 and logs "Detective account linked/created for: ... with 2 services." So approval/creation can succeed if the detective row already exists (e.g. from a previous run or different code path) or if schema is fixed between attempts.
- **SendPulse email:** Approval/claim emails fail with `Template not found` (422). Log: `[SendPulse] HTTP 422 Error { templateId: 1005, ... }`. Non-blocking; approval still completes.
- **Startup warnings:** `Missing policies (dev/test): pagination_default_limit, ...` and `Missing site settings row (dev/test)`. No crash; server starts.
- **CSRF:** One request logged as `[csrf] CSRF blocked: missing or invalid X-Requested-With header` — expected for non-browser or misconfigured client.

---

## 5. Final verdict

**Needs targeted fixes.**

Before considering the app ready for a full code-sanity pass:

1. **Database:** Apply Phase 1 migrations (or equivalent) so `public.detectives` has `blue_tick_addon`, `blue_tick_activated_at`, `has_blue_tick`. Re-run smoke test after applying.
2. **Backend:** Fix `user` scope in `server/routes.ts`: ensure the variable used in the claim-invitation block (e.g. `user?.id` at ~3330) refers to the approved application’s user (e.g. pass `user` from the inner try block or re-resolve user by `application.email`) so claim invitation does not throw `ReferenceError`.

After these two fixes, re-run the full smoke scope (A–D) and then proceed to code sanity.

---

Smoke test complete. No code was changed.
