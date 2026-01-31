# Full End-to-End Functional Audit Report

**Date:** 2025-01-30  
**Scope:** Application-wide (client + server + DB). Report only — no code changes.

---

## 1. Executive Summary

The application is a detective-services platform with **public pages** (home, search, service/detective profiles, CMS pages), **user** (favorites, dashboard), **detective** (profile, services, subscription, billing, reviews, orders), and **admin** (signups, detectives, claims, finance, subscriptions, CMS, snippets, payment gateways, etc.).

**Critical finding:** If the database is missing the `blue_tick_addon` (and optionally `blue_tick_activated_at`, `has_blue_tick`) columns on `public.detectives`, **multiple flows fail at runtime**: `getDetectiveByUserId`, `getDetective`, `searchServices`, `createDetective` (e.g. application approval), and ranking. This produces 404/500 errors and "Detective profile not found" / "Failed to create detective account: write operation failed."

**Other findings:** Several buttons have no backend (Forgot password, Contact Send Message, User Delete Account, Blue Tick Update Pricing, Admin Download Report). One admin UI calls a non-existent API (Apply Service Limits → POST /api/admin/subscription-limits). The route `/admin` is not defined (falls through to CMS catch-all). The CMS admin panel at `/admin/cms` uses sidebar links to `/admin/categories`, `/admin/tags`, `/admin/pages`, `/admin/settings` which do not match the defined routes (correct routes are under `/admin/cms/...`). User dashboard "Delete Account" confirm action has no API call.

---

## 2. Feature List (with status)

| Feature area | Status | Notes |
|-------------|--------|--------|
| **Authentication** | | |
| Login | Works | POST /api/auth/login, redirects by role |
| Logout | Works | POST /api/auth/logout |
| Register (signup) | Partial | Route /signup renders Login component; no dedicated register UI |
| Forgot password | Broken | Link is `<a href="#">` — no handler, no API |
| Change password (authenticated) | Exists | POST /api/auth/change-password, POST /api/auth/set-password |
| **User flows** | | |
| User dashboard | Partial | Renders; "Delete Account" confirm does nothing (no API) |
| Favorites (list, add, remove) | Works | GET/POST/DELETE /api/favorites |
| **Detective flows** | | |
| Detective dashboard | Depends on DB | Uses GET /api/detectives/me; fails if detectives.blue_tick_addon missing |
| Detective profile edit | Depends on DB | Same |
| Detective services CRUD | Works | Services API and storage |
| Detective subscription page | Depends on DB | Needs /api/detectives/me |
| Detective billing | Depends on DB | Same |
| Detective reviews | Works | Reviews API |
| Detective orders | Works | Orders API |
| Public detective page (/p/:id) | Depends on DB | getDetective |
| Public service page (/service/:id) | Depends on DB | getDetective, effectiveBadges |
| **Admin flows** | | |
| Admin dashboard (/admin/dashboard) | Depends on DB | Uses useDetectives, useServices; if ranking/getDetectives fail, stats/empty or 500 |
| Admin signups list & approve/reject | Depends on DB | Approve creates user+detective; fails if blue_tick_addon missing |
| Admin signup detail & approve/reject | Same | Same |
| Admin detectives list | Depends on DB | getAllDetectives includes detectives table |
| Admin view detective | Depends on DB | getDetective |
| Admin claims approve/reject | Works | PATCH /api/claims/:id |
| Admin finance | Works | Admin finance router |
| Admin subscriptions (plans CRUD) | Works | GET/POST/PATCH/DELETE subscription-plans |
| Admin Apply Service Limits | Broken | Calls POST /api/admin/subscription-limits — **route does not exist** (only GET /api/subscription-limits exists) |
| Admin Blue Tick "Update Pricing" | No backend | onClick: `alert("Blue Tick pricing updated!")` — no API |
| Admin Download Report | No handler | Button has no onClick |
| Admin payment gateways | Works | GET/PUT /api/admin/payment-gateways |
| Admin ranking & visibility | Depends on DB | Ranking uses detectives table (blue_tick_addon in schema) |
| Admin snippets | Works | Snippets API; some errors use alert() |
| Admin email templates | Works | Email templates API |
| Admin site settings | Works | PATCH /api/admin/site-settings |
| Admin service categories | Works | Service categories API |
| Admin CMS (categories, tags, pages) | Works | /api/admin/categories, tags, pages (admin-cms router) |
| Admin CMS sidebar (from /admin/cms) | Broken | Links to /admin/categories, /admin/tags, /admin/pages, /admin/settings — **no such routes** (actual: /admin/cms/categories, etc.) |
| **Subscriptions & payments** | | |
| Subscription plans list (public) | Works | GET /api/subscription-plans |
| Detective upgrade (Razorpay/PayPal) | Works | Create order, verify, capture |
| Blue Tick add-on (Razorpay/PayPal) | Works | create-blue-tick-order, verify-blue-tick; PayPal capture for blue-tick |
| Payment history (detective) | Works | GET /api/payments/history |
| **Badges** | | |
| Badge display (Blue Tick, Pro, Recommended) | Depends on DB | effectiveBadges from detective + subscription; reads detectives + subscription_plans |
| **CMS** | | |
| Public CMS pages (/:category/:slug, /pages/:slug) | Works | public-pages router, storage/cms |
| Admin CMS categories/tags/pages | Works | admin-cms router |
| **Search & filters** | | |
| Home services list | Depends on DB | searchServices + ranking; fails if blue_tick_addon missing |
| Search page | Same | Same |
| Categories page | Works | Categories, service categories |
| **Favorites** | Works | See User flows |
| **Reviews** | Works | GET/POST/PATCH/DELETE reviews |
| **Orders** | Works | Orders API |
| **Detective application (signup)** | | |
| Submit application | Works | POST /api/applications |
| Application under review (applicant login) | Works | Login returns applicant, redirect to /application-under-review |
| Admin approve application | Depends on DB | Creates user + detective; **fails if detectives.blue_tick_addon missing** |
| **Claim profile / claim account** | Works | Claims API, claim-account verify/finalize |
| **Health / dev** | | |
| GET /api/health/db | Exists | DB health check |
| GET /api/dev/audit-storage | Exists | Dev audit (no auth) |

---

## 3. Button & Action Audit

| Location | Button / CTA | Handler | API / route | Status |
|----------|--------------|---------|-------------|--------|
| Login page | Sign in | handleLogin | POST /api/auth/login | Works |
| Login page | Forgot password? | None (href="#") | — | **No handler** |
| Login page | Join here (signup) | Link to /signup | Renders Login | Partial (same form) |
| Contact page | Send Message | None (form has no onSubmit) | — | **No handler** |
| User dashboard | Delete Account → Confirm | AlertDialogAction (no onClick) | — | **No API call** |
| Admin dashboard | Download Report | None | — | **No handler** |
| Admin dashboard | Add Detective | Link | /admin/detectives/add | Works |
| Admin signups | Approve (check) | handleApprove | PATCH /api/applications/:id { status: "approved" } | **Broken if DB missing blue_tick_addon** |
| Admin signups | Reject | confirmReject | PATCH /api/applications/:id { status: "rejected" } | Works |
| Admin signup detail | Approve Detective | updateStatus.mutateAsync | Same | **Broken if DB missing column** |
| Admin signup detail | Reject Application | Dialog → updateStatus | Same | Works |
| Admin subscriptions | Update Pricing (Blue Tick) | onClick: alert(...) | — | **No backend** |
| Admin subscriptions | Apply Service Limits | applyServiceLimits | POST /api/admin/subscription-limits | **API does not exist (404)** |
| Admin subscriptions | Create New Plan, Edit, Delete | api.subscriptionPlans | POST/PATCH/DELETE /api/subscription-plans | Works |
| Admin CMS (index) | Categories, Tags, Pages, Settings | navigate(...) | /admin/categories, etc. | **Wrong paths → 404 or wrong page** |
| Admin snippets | Create/Edit/Delete snippet | api.post/put/delete | /api/snippets | Works (errors shown via alert in places) |
| Detective subscription | Add Blue Tick, Plan upgrade | Various | create-blue-tick-order, verify-blue-tick, paypal/capture, upgrade-plan | Works (if DB has columns) |
| Detective billing | — | — | GET /api/billing | Works |
| Detective profile edit | Save | updateDetective | PATCH /api/detectives/:id | Works |
| Detective services | Add/Edit/Delete service | api.services | POST/PATCH/DELETE /api/services | Works |
| Home / Search | Service card click | Link | /service/:id | Depends on DB |
| Navbar | Admin Dashboard / Dashboard / Favorites / Log out | Link or logout | /admin/dashboard, /detective/dashboard, /user/dashboard, /user/favorites, logout | Works |

---

## 4. Route & Navigation Audit

### 4.1 Public routes

| Route | Component | Auth | Status |
|-------|-----------|------|--------|
| / | Home | No | Reachable; list depends on searchServices/ranking (DB) |
| /service/:id | DetectiveProfile | No | Reachable; fails if getDetective/searchServices fail (DB) |
| /claim-profile/:id | ClaimProfile | No | Reachable |
| /claim-account | ClaimAccount | No | Reachable |
| /login | Login | No | Reachable |
| /signup | Login | No | Reachable (same as login) |
| /detective-signup | DetectiveSignup | No | Reachable |
| /application-under-review | ApplicationUnderReview | No | Reachable |
| /search | SearchPage | No | Reachable; results depend on DB |
| /category/:name | SearchPage | No | Reachable |
| /categories | CategoriesPage | No | Reachable |
| /blog/category/:slug | PageCategory | No | Reachable |
| /blog/tag/:slug | PageTag | No | Reachable |
| /about, /privacy, /terms, /packages, /blog, /support, /contact | Static pages | No | Reachable |
| /p/:id | DetectivePublicPage | No | Reachable; content depends on getDetective (DB) |
| /:category/:slug, /pages/:category/:slug, /pages/:slug | PageView (CMS) | No | Reachable |

### 4.2 User routes

| Route | Component | Auth | Status |
|-------|-----------|------|--------|
| /user/dashboard | UserDashboard | User | Enforced by layout/role; "Delete Account" does nothing |
| /user/favorites | FavoritesPage | User | Enforced; works |

### 4.3 Detective routes

| Route | Component | Auth | Status |
|-------|-----------|------|--------|
| /detective/dashboard | DetectiveDashboard | Detective | Fails if /api/detectives/me fails (DB) |
| /detective/profile | DetectiveProfileEdit | Detective | Same |
| /detective/services | DetectiveServices | Detective | Same |
| /detective/reviews | DetectiveReviews | Detective | Works |
| /detective/subscription | DetectiveSubscription | Detective | Depends on /api/detectives/me (DB) |
| /detective/billing | DetectiveBilling | Detective | Same |
| /detective/settings | DetectiveSettings | Detective | Same |

### 4.4 Admin routes

| Route | Component | Auth | Status |
|-------|-----------|------|--------|
| **/admin** | **Not defined** | — | **Falls through to /:category/:slug → PageView(category=admin, slug=undefined) — broken / wrong page** |
| /admin/dashboard | AdminDashboard | Admin | Reachable; stats/APIs depend on DB |
| /admin/finance | AdminFinance | Admin | Reachable |
| /admin/signups | AdminSignups | Admin | Reachable |
| /admin/signups/:id | AdminSignupDetails | Admin | Reachable |
| /admin/detectives/add | AdminAddDetective | Admin | Reachable |
| /admin/detective/:id/view | AdminViewDetective | Admin | Reachable |
| /admin/detectives | AdminDetectives | Admin | Reachable (list can fail if DB missing column) |
| /admin/claims | AdminClaims | Admin | Reachable |
| /admin/services | AdminServices | Admin | Reachable |
| /admin/service-categories | AdminServiceCategories | Admin | Reachable |
| /admin/subscriptions | AdminSubscriptions | Admin | Reachable |
| /admin/pages | AdminPages | Admin | Reachable (links to some non-CMS URLs) |
| /admin/settings | AdminSettings | Admin | Reachable |
| /admin/payment-gateways | AdminPaymentGateways | Admin | Reachable |
| /admin/branding | AdminBranding | Admin | Reachable |
| /admin/ranking-visibility | AdminRankingVisibility | Admin | Fails if ranking fails (DB) |
| /admin/email-templates | AdminEmailTemplates | Admin | Reachable |
| /admin/snippets | AdminSnippets | Admin | Reachable |
| /admin/cms | AdminDashboardCMS (admin/index.tsx) | Admin | Reachable; **sidebar links to /admin/categories, /admin/tags, /admin/pages, /admin/settings — no such routes** |
| /admin/cms/categories | AdminCategories | Admin | Reachable |
| /admin/cms/tags | AdminTags | Admin | Reachable |
| /admin/cms/pages | AdminPagesEdit | Admin | Reachable |
| /admin/cms/pages/:id/edit | PageEdit | Admin | Reachable |

---

## 5. Database Interaction Audit

### 5.1 Tables read/written by feature

- **users:** Auth (login, register), detective creation (approve application), claim approval, admin reset password.  
  **Reads:** getDetectiveByUserId, getDetective (join), getApplication, claims, etc.  
  **Writes:** createUser, createUserFromHashed, updateUserRole, updateUser, reset password.
- **detectives:** All detective and service flows.  
  **Reads:** getDetective, getDetectiveByUserId, getAllDetectives, searchServices (join), ranking (db.select from detectives).  
  **Writes:** createDetective, updateDetective, updateDetectiveAdmin.  
  **Critical:** Schema expects `blue_tick_addon`, `blue_tick_activated_at`, `has_blue_tick`. If these columns are missing in DB, **all reads/writes that include detectives table fail** (42703).
- **subscription_plans:** Subscription list, getDetective (join), searchServices (join), applyPackageEntitlements, getFreePlanId.
- **services:** searchServices, getService, createService, updateService, etc.
- **reviews, orders, favorites:** Standard CRUD.
- **detective_applications:** Applications list, get by id, update status, delete on approve/reject.
- **profile_claims:** Claims list, approve/reject.
- **payment_orders:** Payment create/verify, history.
- **detective_visibility:** Ranking, visibility PATCH.
- **detective_snippets:** Snippets CRUD.
- **CMS tables (categories, tags, pages):** admin-cms and public-pages routers.
- **session:** Session store (login/logout).
- **site_settings, app_policies, email_templates, billing_history, claim_tokens, search_stats, payment gateways:** Various admin/settings features.

### 5.2 Known DB-related failures (when columns missing)

- **Writes that fail:**  
  - `createDetective` (e.g. on application approve): INSERT into detectives includes `blue_tick_addon` → "column blue_tick_addon does not exist".
- **Reads that fail:**  
  - `getDetectiveByUserId`, `getDetective`: SELECT from detectives (with joins) → same error.  
  - `searchServices`: JOIN detectives → same error.  
  - `getRankedDetectives` / ranking: SELECT from detectives → same error.
- **Effect:** Detective profile not found (404), search/services 500, ranking errors, application approve fails with "write operation failed."

### 5.3 Tables that may be empty or unused

- **search_stats:** Populated by recordSearch; used for popular categories. May be empty if no search traffic.
- **billing_history:** Written by some payment flows; may be empty if not integrated everywhere.
- **claim_tokens:** Used for claim-account flow; populated on claimable approval.

---

## 6. Broken / Dead Features

1. **Forgot password** — Link only (`href="#"`). No route, no API call, no modal.
2. **Contact "Send Message"** — Form has no `onSubmit`; button does not submit to any API.
3. **User dashboard "Delete Account"** — Confirm button in AlertDialog has no `onClick`; no delete-user API called.
4. **Admin "Download Report"** — No click handler.
5. **Admin Blue Tick "Update Pricing"** — `onClick` only shows `alert(...)`. No API to persist Blue Tick pricing.
6. **Admin "Apply Service Limits"** — Calls POST `/api/admin/subscription-limits`. **This route does not exist** (only GET `/api/subscription-limits` exists) → 404.
7. **Route /admin** — Not defined in App. Resolves to catch-all `/:category/:slug` (PageView) with category=admin, slug=undefined → wrong or broken page.
8. **CMS admin sidebar (when on /admin/cms)** — Links to `/admin/categories`, `/admin/tags`, `/admin/pages`, `/admin/settings`. **None of these routes exist.** Correct routes are `/admin/cms/categories`, `/admin/cms/tags`, `/admin/cms/pages`; `/admin/settings` exists but is different from CMS.
9. **Application approve (create detective)** — Fails at DB insert when `detectives.blue_tick_addon` (and related columns) are missing. User sees "Failed to create detective account: write operation failed."
10. **Any flow that reads detectives** (me, profile, search, ranking) — Fails with 42703 when `blue_tick_addon` is missing.

---

## 7. Partial / Unfinished Features

1. **Signup vs Login** — `/signup` renders the same Login component; no dedicated registration form or API usage for "register" as user.
2. **User dashboard** — "Recently Visited Profiles" is static (no data fetched). Delete account has no implementation.
3. **Admin pages list** (AdminPages) — Lists hardcoded URLs (e.g. /detectives, /register); some do not match actual routes (/register not defined, /detectives not defined).
4. **Detective profile edit** — TODOs in code: "Fetch plan features from API instead of hardcoded name check"; "check features instead" for phone/whatsapp visibility.
5. **Password reset** — Backend (set-password, reset token) and email templates exist; no "Forgot password" UI or request-reset endpoint wired.
6. **Subscription limits** — GET returns limits; UI has "Apply Service Limits" but no POST handler to update limits in DB.

---

## 8. Risk Assessment (what can break prod)

| Risk | Severity | Condition |
|------|----------|-----------|
| Detective and service flows unusable | **Critical** | DB missing `blue_tick_addon` (and optionally `blue_tick_activated_at`, `has_blue_tick`) on `detectives` |
| Application approval always fails | **Critical** | Same missing columns → createDetective fails |
| Search and home return 500 | **Critical** | searchServices / ranking use detectives table |
| GET /api/detectives/me 404 for detectives | **Critical** | getDetectiveByUserId fails → "Detective profile not found" |
| Admin "Apply Service Limits" 404 | **High** | POST /api/admin/subscription-limits not implemented |
| Admin navigating from /admin/cms to Categories/Tags/Pages | **High** | Wrong URLs → 404 or wrong page |
| User/Admin hitting /admin | **Medium** | No route → catch-all CMS page (confusing or broken) |
| Forgot password / Contact / Delete account / Download Report / Blue Tick pricing | **Medium** | No backend or no handler — feature appears but does nothing |

---

## 9. Recommended Fix Order (no code yet)

1. **Database schema** — Ensure `public.detectives` has `blue_tick_addon` (BOOLEAN NOT NULL DEFAULT false), and if used by code, `blue_tick_activated_at` and `has_blue_tick`. Apply migration or run SQL in the same DB as the app. This unblocks detective, search, ranking, and application approval.
2. **Apply Service Limits** — Either add POST `/api/admin/subscription-limits` that updates plan service limits, or change the button to use an existing API (if any).
3. **/admin route** — Define a route for `/admin` (e.g. redirect to `/admin/dashboard` or render a dashboard) so it does not fall through to CMS catch-all.
4. **CMS admin sidebar** — Fix links from /admin/cms so they point to `/admin/cms/categories`, `/admin/cms/tags`, `/admin/cms/pages` (and keep /admin/settings as is if intended).
5. **Forgot password** — Add a "Forgot password?" flow (request reset → email with link → set-password or reset token endpoint) and wire the link.
6. **Contact form** — Add onSubmit and backend (e.g. POST to contact or email API) or remove/substitute with mailto or external form.
7. **User Delete Account** — Implement delete-user (or deactivate) API and wire AlertDialogAction to it.
8. **Blue Tick Update Pricing** — Either persist Blue Tick pricing (e.g. site_settings or subscription_plans) and add API, or remove the button.
9. **Download Report** — Add handler (e.g. export detectives or finance report) or remove the button.
10. **Admin Pages list** — Align listed URLs with actual routes or remove broken links.

---

**End of report. No code or behavior was changed. Awaiting confirmation before any fixes.**
