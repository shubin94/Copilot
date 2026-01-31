# Codebase Analysis Report — Read-Only

**Project:** AskDetective (private detectives web portal, Fiverr-like)  
**Analysis date:** 2025-01-30  
**Mode:** Read-only (no code changes)

---

## 1. Repository Structure and Purpose

### Root

| Path | Purpose |
|------|--------|
| `api/index.ts` | Vercel serverless entry; creates Express app and wraps with `serverless-http`; only registers routes (no static/Vite). |
| `client/` | React SPA: `index.html`, `public/` assets, `src/` (App, components, pages, lib, hooks, types, utils). |
| `server/` | Express backend: `app.ts`, `config.ts`, `routes.ts`, `storage.ts`, `storage/cms.ts`, `routes/*.ts`, `services/*.ts`, `supabase.ts`, `policy.ts`, `email.ts`, `startup.ts`, `index-dev.ts`, `index-prod.ts`. |
| `db/index.ts` | Drizzle ORM setup: `drizzle(pool, { schema })` from `shared/schema.ts`; single Pool. |
| `shared/` | `schema.ts` (Drizzle tables + Zod), `content-blocks.ts`. |
| `lib/` | `templateVariables.ts`. |
| `migrations/` | Drizzle-generated SQL (e.g. `0000_foamy_cammi.sql` … `0024_*`); `meta/_journal.json` has only one entry. |
| `supabase/migrations/` | Supabase-specific SQL: CMS tables, payment_gateways, payment_orders PayPal columns, detectives blue_tick/signup_country, triggers. |
| `scripts/` | One-off scripts: DB audit, seed, migrations, cleanup, payment sync, etc. |
| `tests/` | Playwright: `smoke.spec.ts`, `admin_flow.spec.ts`, `auth_review.spec.ts`. |
| `drizzle.config.ts` | Drizzle Kit config; schema from `shared/schema.ts`, out `./migrations`. |
| `vite.config.ts` | Vite + React, Tailwind, path aliases (`@`, `@shared`, `@assets`), no proxy defined in file. |
| `.github/` | CI workflows (2 `.yml`). |
| `.vercel/` | Vercel project config. |
| Many `.md` | Docs (auth, block editor, CMS, blue tick, payments, etc.). |
| Root `*.ts` | Ad-hoc scripts (check-*, add-*, verify-*, test-*, debug-*, apply-*, etc.). |

### Client (`client/src`)

| Path | Purpose |
|------|--------|
| `App.tsx` | Wouter routes, lazy pages, QueryClient/User/Currency/Tooltip providers, auth session init, ScrollToTop, CountrySelectorPopup, SmokeTester. |
| `main.tsx` | React root render. |
| `components/` | `admin/`, `content-editor/`, `forms/`, `home/`, `layout/`, `modals/`, `payment/`, `ui/` (Radix-based), `seo.tsx`, `scroll-to-top.tsx`, `snippets/`. |
| `pages/` | Public (home, search, detective-profile, auth, claim-*, categories, blog, static); admin/*; detective/*; user/*; CMS (page-view, page-category, page-tag). |
| `lib/` | `api.ts`, `authProtection.tsx`, `authSessionManager.ts`, `user-context.tsx`, `currency-context.tsx`, `queryClient.ts`, `hooks.ts`, country/geo utils. |
| `shared/content-blocks.ts` | Block types/parsing (used by client and server CMS). |

### Server

| Path | Purpose |
|------|--------|
| `app.ts` | Express: helmet, compression, rate-limit on `/api/auth/`, PG or memory session, CSRF (origin/referer + `X-Requested-With`), request logging, subscription expiry scheduler. |
| `config.ts` | Env-based config (db, session, rate limit, email, SendPulse, Supabase, CSRF, Razorpay, PayPal). |
| `routes.ts` | Single large file: `registerRoutes(app)` — all API handlers (auth, admin, detectives, services, reviews, orders, favorites, applications, claims, payments, subscription plans, email templates, billing, snippets, payment gateways, health). Mounts sub-routers: paymentGateways, public-pages, public-categories, public-tags, admin-cms, admin-finance. |
| `storage.ts` | `DatabaseStorage` implementing `IStorage`: CRUD for users, detectives, services, reviews, orders, payment orders, favorites, applications, profile claims, billing, snippets, visibility; uses Drizzle + raw SQL where needed. |
| `storage/cms.ts` | CMS only: raw SQL via `pool` for categories, tags, pages, page_tags; no Drizzle schema for CMS tables. |
| `policy.ts` | `getPolicy` / `requirePolicy` reading `app_policies` table. |
| `startup.ts` | `validateDatabase()`: checks required `app_policies` keys and at least one `site_settings` row. |
| `email.ts` | SendGrid, SMTP, fallback (console); `sendClaimApprovedEmail`. |
| `services/` | freePlan, paymentGateway, paypal, claimTokenService, emailTemplateService, resendEmail, sendpulseEmail, subscriptionExpiry. |
| `routes/` | admin-cms (categories, tags, pages with requireAdmin), admin-finance, paymentGateways (enabled list), public-pages, public-categories, public-tags. |
| `supabase.ts` | Supabase client; `uploadDataUrl`, `deletePublicUrl`, `parsePublicUrl` for storage. |

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ESM) |
| Backend | Express 4.x |
| Frontend | React 18, Vite 5, Wouter (routing) |
| DB | PostgreSQL (Drizzle ORM + raw `pg`/`pool`) |
| Session | express-session; store: connect-pg-simple (table `session`) or MemoryStore in dev |
| Auth | Session-based (userId, userRole in session); bcrypt passwords; no JWT in app code |
| Validation | Zod (drizzle-zod for schema-derived schemas) |
| UI | Radix UI, Tailwind CSS 4, Framer Motion, Lucide, cmdk |
| Data fetching | TanStack Query (React Query) |
| Payments | Razorpay, PayPal (SDK + DB-driven gateway config in `payment_gateways` table) |
| Email | SendGrid, SMTP (nodemailer), SendPulse (transactional by template ID); Resend in services |
| Storage | Supabase (buckets) for uploads |
| Errors | Sentry (prod, optional via SENTRY_DSN) |
| Dev | tsx, Vite dev server as middleware in Express |
| Deploy | Vercel (api/index.ts serverless), or standalone (index-prod serves built client from dist/public) |

---

## 3. Backend Deep Dive

### 3.1 Entry and Bootstrap

- **Dev:** `server/index-dev.ts` — `validateConfig()` in prod only, `validateDatabase()`, `runApp(setupVite)`; Vite middleware + catch-all to `index.html`.
- **Prod:** `server/index-prod.ts` — Sentry init, `validateConfig()` in prod, `validateDatabase()`, `runApp(serveStatic)`; serves `dist/public` and fallback to `index.html`.
- **Vercel:** `api/index.ts` — Express app with `registerRoutes(app)` only; no static or Vite; serverless-http wrapper.

### 3.2 Routing

- **Central:** All API routes in `server/routes.ts` via `registerRoutes(app)`.
- **Auth:** `requireAuth` (session userId), `requireRole(...roles)` (session userRole).
- **Mount order:** Explicit routes first (e.g. `/api/admin/db-check`, `/api/admin/finance` with `requireRole("admin")`), then:
  - `app.use("/api/payment-gateways", paymentGatewayRoutes)`
  - `app.use("/api/public/pages", publicPagesRouter)` (and categories, tags)
  - `app.use("/api/admin", adminCmsRouter)` — **no** global `requireRole("admin")`; admin-cms uses its own `requireAdmin` (session userId + role === "admin").
  - `app.use("/api/admin/finance", requireRole("admin"), adminFinanceRouter)`
- **Email templates:** Handlers under `/api/admin/email-templates` implement auth inline (session + DB user role check), not `requireRole("admin")`.

### 3.3 Controllers / Services / Models

- **Controllers:** Effectively inline in `routes.ts` (large file); no separate controller layer.
- **Services:** `server/services/` — freePlan, paymentGateway (DB config), paypal, claimTokenService, emailTemplateService, sendpulseEmail, resendEmail, subscriptionExpiry.
- **Models:** Drizzle schema in `shared/schema.ts`; CMS (categories, tags, pages, page_tags) has **no** Drizzle schema — only raw SQL in `storage/cms.ts` and Supabase migrations.

### 3.4 Database Schema and Migrations

- **Drizzle schema (`shared/schema.ts`):** users, detectives, service_categories, services, service_packages, reviews, orders, favorites, detective_applications, profile_claims, billing_history, session, site_settings, search_stats, app_policies, subscription_plans, payment_orders, detective_visibility, claim_tokens, email_templates, detective_snippets. **Not in schema:** `payment_gateways`, CMS tables (categories, tags, pages, page_tags), `countries`.
- **Drizzle migrations (`migrations/`):** Multiple SQL files (0000–0024); `meta/_journal.json` lists only `0000_foamy_cammi` — journal not updated for later migrations; likely applied manually or via another path.
- **Supabase migrations (`supabase/migrations/`):** CMS tables (20260130), payment_gateways and payment_orders changes (20260130123345), CMS completion (20260131); also triggers for `detectives` that reference `countries` and columns `signup_country_id`, `signup_country_iso2` (see Risks).

### 3.5 Auth and Session

- **Session:** express-session; cookie httpOnly, sameSite lax, secure in prod; TTL and secret from config; store in PG table `session` or memory.
- **CSRF:** For POST/PUT/PATCH/DELETE, origin or referer must be in `config.csrf.allowedOrigins` and `X-Requested-With: XMLHttpRequest` required.
- **Auth endpoints:** `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password`, `/api/auth/set-password`.
- **Role checks:** `requireAuth` and `requireRole("admin" | "detective" | "user")` used per route; email-templates use inline admin check.

---

## 4. Frontend Deep Dive

### 4.1 App Entry

- **main.tsx:** Renders `<App />`.
- **App.tsx:** QueryClientProvider, UserProvider, CurrencyProvider, TooltipProvider; Toaster, SmokeTester; `useEffect` calling `initializeAuthSession` (authSessionManager); Router with ScrollToTop, CountrySelectorPopup, Suspense + Wouter Switch/Route; lazy-loaded page components.

### 4.2 Page Routing (Wouter)

- **Public:** `/`, `/service/:id`, `/claim-profile/:id`, `/claim-account`, `/login`, `/signup`, `/detective-signup`, `/application-under-review`, `/search`, `/category/:name`, `/categories`, `/blog/category/:slug`, `/blog/tag/:slug`, static (about, privacy, terms, packages, blog, support, contact).
- **Admin:** `/admin/dashboard`, `/admin/finance`, `/admin/signups`, `/admin/signups/:id`, `/admin/detectives`, `/admin/detective/:id/view`, `/admin/detectives/add`, `/admin/claims`, `/admin/services`, `/admin/service-categories`, `/admin/subscriptions`, `/admin/pages`, `/admin/settings`, `/admin/payment-gateways`, `/admin/branding`, `/admin/ranking-visibility`, `/admin/email-templates`, `/admin/snippets`, `/admin/cms`, `/admin/cms/categories`, `/admin/cms/tags`, `/admin/cms/pages`, `/admin/cms/pages/:id/edit`.
- **Detective:** `/detective/dashboard`, profile, services, reviews, subscription, billing, settings; `/p/:id` (public detective page).
- **User:** `/user/dashboard`, `/user/favorites`.
- **CMS public:** `/:category/:slug`, `/pages/:category/:slug`, `/pages/:slug`, then NotFound.

### 4.3 Forms and Validation

- **Detective application:** `DetectiveApplicationForm` with Zod-style validation; submission to `/api/applications`.
- **Login/register:** Forms calling `api.auth.login` / `api.auth.register`.
- **CMS page edit:** Block editor; admin-cms POST/PATCH pages with Zod in router.
- **Validation:** Zod on server (routes, storage); client uses same types from `@shared/schema` and API shapes.

### 4.4 API Calls and Data Flow

- **Client API:** `client/src/lib/api.ts` — `get/post/put/delete` + `api.auth.*`, `api.detectives.*`, `api.services.*`, etc. All mutation methods use `csrfFetch` (adds `X-Requested-With: XMLHttpRequest`). Base URL is same origin (no explicit proxy in vite.config; dev assumed to run behind same server that serves Vite).
- **Auth:** `api.auth.me()` → `/api/auth/me`; used by `useAuth()` (React Query); `UserProvider` and `withAuthProtection` / `useRequireAuth` depend on it.
- **401/403:** `authSessionManager.handleSessionInvalid()` clears cache, localStorage (favorites, auth_state), sessionStorage, sets logout_event, then `window.location.replace('/login')`.

### 4.5 State Management

- **Server state:** TanStack Query (useAuth, useDetectives, useSubscriptionPlits, etc.).
- **Client state:** React (useState); `UserContext` (user, favorites, logout); `CurrencyContext` (preferences, persisted via `/api/users/preferences`).
- **Favorites:** Stored in **localStorage** and in `UserContext`; backend has `/api/favorites` (requireAuth) for sync — so favorites are both in DB (when logged in) and in localStorage (project requirement said “no data in browser local storage” — deviation).

---

## 5. Integrations

### 5.1 Payments

- **Razorpay:** Initialized from config (env); routes can override with DB config via `getPaymentGateway('razorpay')`. Create order, verify signature, apply entitlements (subscription/blue tick).
- **PayPal:** `server/services/paypal.ts`; create order, capture; payment_orders has paypal_order_id, paypal_payment_id, paypal_transaction_id; verify flow in routes.
- **Gateway config:** Table `payment_gateways` (name, display_name, is_enabled, is_test_mode, config JSONB); not in Drizzle schema; used by `server/services/paymentGateway.ts` and routes.

### 5.2 Email / Notifications

- **SendGrid:** config.email.sendgridApiKey/FromEmail; used in `email.ts`.
- **SMTP:** nodemailer in `email.ts`; config.email.smtp*.
- **SendPulse:** `server/services/sendpulseEmail.ts`; template IDs (e.g. DETECTIVE_APPLICATION_APPROVED); env: SENDPULSE_API_ID, SENDPULSE_API_SECRET, SENDPULSE_SENDER_EMAIL, SENDPULSE_ENABLED.
- **Templates:** DB table `email_templates`; admin UI and `emailTemplateService` for body/subject and variables.
- **Approval/rejection/claim:** SendPulse used in routes for detective application and claim emails; support email hard-coded (e.g. support@askdetectives.com).

### 5.3 Third-Party APIs

- **Supabase:** Storage (uploadDataUrl, etc.); env SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
- **Sentry:** Optional; index-prod and app.ts; SENTRY_DSN.
- **Currency:** Client-side country/currency mapping; `/api/currency-rates` and `/api/users/preferences` for storing preference.

---

## 6. Key Flows End-to-End

### 6.1 User Signup and Login

1. **Register:** POST `/api/auth/register` (email, password, name) → bcrypt hash → insert user (role default "user") → session not set in snippet; caller typically then logs in.
2. **Login:** POST `/api/auth/login` (email, password) → getUserByEmail, bcrypt.compare → session userId, userRole set → response with user.
3. **Client:** Login form → `api.auth.login` → invalidate ["auth"] → UserProvider/useAuth refetch `/api/auth/me`; protected routes use withAuthProtection or useRequireAuth.

### 6.2 Detective Signup and Approval

1. **Signup:** Public form `DetectiveApplicationForm` → POST `/api/applications` (no auth) → insert `detective_applications`; redirect to `/application-under-review`.
2. **Admin:** GET `/api/applications`, PATCH `/api/applications/:id` with status approved/rejected.
3. **Approved:** Create user (if new) with role "detective", create detective row (subscriptionPackageId null, FREE plan applied via ensureDetectiveHasPlan elsewhere); optional services from application; SendPulse approval email; if claimable, create claim token and send claim email; delete application.
4. **Rejected:** SendPulse rejection email; delete application.

### 6.3 Package Creation and Purchase

1. **Plans:** Admin POST/PATCH/DELETE `/api/subscription-plans`; table `subscription_plans` (monthly_price, yearly_price, badges, etc.).
2. **Purchase (Razorpay):** Detective POST `/api/payments/create-order` → create payment_order, Razorpay order → return order id; client completes payment; POST `/api/payments/verify` (razorpay_order_id, payment_id, signature) → verify signature, mark paid, apply entitlements (applyPackageEntitlements), update detective subscription fields.
3. **Purchase (PayPal):** POST `/api/payments/paypal/create-order`, then `/api/payments/paypal/capture`; similar apply entitlements.
4. **Blue Tick:** Separate create-order/verify-blue-tick flow; guard against duplicate active Blue Tick.
5. **Free plan:** `getFreePlanId()` from subscription_plans where monthly_price = 0; used when detective has no package.

### 6.4 Admin / Super Admin

1. **Access:** Routes use requireRole("admin") or (in admin-cms) requireAdmin middleware; client admin pages rely on useAuth or a user check.
2. **CMS:** Admin at `/admin/cms`; categories, tags, pages CRUD via admin-cms router; pages have content (block JSON), banner_image, meta_title, meta_description (update only; create doesn’t accept meta*).
3. **Finance:** admin-finance router under `/api/admin/finance` (requireRole("admin")).
4. **Dashboard:** Main admin dashboard at `/admin/dashboard`; CMS dashboard at `/admin/cms` (index) — both use `/api/user` for “current user” (see Broken flows).

---

## 7. Assumptions, Hard-Coded Values, Env

### 7.1 Assumptions

- FREE plan exists in `subscription_plans` with monthly_price = 0 and is_active = true; otherwise getFreePlanId() throws.
- Required `app_policies` keys exist in prod: pagination_default_limit, pagination_default_offset, visibility_requirements, post_approval_status, pricing_constraints.
- At least one `site_settings` row in prod.
- CMS tables (categories, tags, pages, page_tags) exist and match Supabase migrations (and cms.ts column names).
- Session store table `session` exists (connect-pg-simple can create if configured).
- Payment gateways table exists; Razorpay/PayPal keys can come from env or DB.
- Detectives have either subscriptionPackageId or are assigned FREE via ensureDetectiveHasPlan where that’s called.
- Content block format (client/shared/content-blocks.ts) is shared between client and server for parsing/serialization.

### 7.2 Hard-Coded Values

- Support email in emails: e.g. `support@askdetectives.com`.
- Sender name "FindDetectives" in email.ts; "Ask Detectives" in SendPulse.
- Rate limit window/max in config defaults (e.g. 15 min, 100/1000).
- Session TTL default 7 days; cookie secure only in prod.
- Subscription expiry check daily at 2 AM.
- Pagination defaults (e.g. limit 50) in routes.
- Detective application schema: max 2 service categories, max 2 category pricing entries.

### 7.3 Environment Variables

- **Required (prod):** DATABASE_URL, SESSION_SECRET, HOST (if prod), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; at least one email path (SendGrid or SMTP or SendPulse); Razorpay keys (config validates in prod).
- **Optional:** PORT, RATE_LIMIT_*, SESSION_USE_MEMORY, SESSION_TTL_MS, CSRF_ALLOWED_ORIGINS, SENDPULSE_*, SENTRY_DSN, PAYPAL_*, DB_ALLOW_INSECURE_DEV, NODE_ENV.

---

## 8. Critical Risks / Broken Flows / DB Mismatches

### 8.1 Critical

1. **Missing API route `/api/user`**  
   - **Where:** `client/src/pages/admin/index.tsx`, `client/src/components/admin/AdminLayout.tsx` call `fetch("/api/user")` to get current user and check `role === "admin"`.  
   - **Backend:** Only `/api/auth/me` returns current user; there is no `/api/user` route.  
   - **Effect:** Admin CMS dashboard and any layout using AdminLayout get 404 or non-JSON for “current user” and treat as not authenticated → access denied or broken UI for admin.

2. **Supabase migration depends on missing `countries` table and columns**  
   - **Where:** `supabase/migrations/20260130123345_add_new_tables_or_columns.sql` (and 20260129084218) define trigger `detectives_iso_enforce` on `detectives` that references `countries` (e.g. `SELECT iso_code FROM countries WHERE id = NEW.signup_country_id`) and set `NEW.signup_country_iso2` / `signup_country_id`.  
   - **Schema:** `shared/schema.ts` detectives table has no `signup_country_id` or `signup_country_iso2`; there is no `countries` table in the codebase.  
   - **Effect:** If these migrations run on a DB that doesn’t have `countries` or the new columns, trigger creation or INSERT/UPDATE on detectives can fail (reference to undefined table/columns or runtime errors in trigger).

### 8.2 High

3. **Favorites in localStorage**  
   - **Where:** `client/src/lib/user-context.tsx` keeps favorites in localStorage and syncs via toggle; authSessionManager clears `localStorage.removeItem('favorites')` on logout.  
   - **Requirement:** Project overview stated “no data should be stored in browser local storage.”  
   - **Effect:** Violation of stated requirement; favorites also persisted in DB for logged-in users via `/api/favorites`.

4. **Payment gateways table not in Drizzle schema**  
   - **Where:** `server/services/paymentGateway.ts` and routes use table `payment_gateways` via raw SQL.  
   - **Schema:** `shared/schema.ts` does not define `payment_gateways`.  
   - **Effect:** No type safety or schema-driven migrations for this table; migrations live only in Supabase/migrations; risk of drift.

5. **CMS tables not in Drizzle schema**  
   - **Where:** `server/storage/cms.ts` and routes use `categories`, `tags`, `pages`, `page_tags` via raw SQL.  
   - **Schema:** Only in Supabase migrations, not in shared/schema.ts.  
   - **Effect:** Two migration systems (Drizzle vs Supabase); CMS schema changes can get out of sync with code (e.g. banner_image, meta_title, meta_description).

### 8.3 Medium

6. **Drizzle migrations journal out of date**  
   - **Where:** `migrations/meta/_journal.json` contains only one entry (0000_foamy_cammi); many more SQL files exist (0001–0024).  
   - **Effect:** Drizzle Kit may not know about later migrations; running drizzle-kit migrate could be inconsistent or duplicate work; source of truth unclear.

7. **POST create page does not accept meta_title / meta_description**  
   - **Where:** admin-cms POST `/api/admin/pages` parses body without metaTitle/metaDescription; createPage() only inserts title, slug, category_id, content, banner_image, status.  
   - **Effect:** New pages get null SEO fields; they can only be set via PATCH. Minor UX gap.

8. **Email template admin routes use inline auth**  
   - **Where:** `/api/admin/email-templates` GET/GET/:key/PUT/toggle/test-all check session and then query user role manually instead of requireRole("admin").  
   - **Effect:** Behavior is correct but inconsistent with rest of admin API; easier to forget to lock down new endpoints.

---

## 9. Final Structured Summary

### 9.1 Architecture (Textual)

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     CLIENT (Vite/React)                   │
                    │  App → Router (Wouter) → Lazy Pages                       │
                    │  UserProvider, CurrencyProvider, TanStack Query           │
                    │  api.ts (csrfFetch) → /api/*                               │
                    └───────────────────────────┬──────────────────────────────┘
                                                │ same-origin
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                          EXPRESS (server/app.ts + routes.ts)                                    │
│  helmet, compression, rate-limit(/api/auth), session (PG or memory), CSRF                     │
│  registerRoutes(app) → auth, users, detectives, services, reviews, orders, favorites,          │
│    applications, claims, payments (Razorpay/PayPal), subscription-plans,                      │
│    email-templates, billing, snippets, payment-gateways, site-settings, health                  │
│  Mounted: /api/payment-gateways, /api/public/pages|categories|tags, /api/admin (cms),           │
│           /api/admin/finance                                                                   │
└───────────────────────────┬───────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ storage.ts    │   │ storage/cms.ts│   │ services/     │
│ (Drizzle +    │   │ (raw SQL      │   │ paypal,       │
│  IStorage)    │   │  categories,  │   │ paymentGateway│
│               │   │  tags, pages) │   │ freePlan,     │
└───────┬───────┘   └───────┬───────┘   │ sendpulse, etc│
        │                   │           └───────┬───────┘
        ▼                   ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                    │
│  Drizzle schema: users, detectives, services, reviews, orders, │
│    payment_orders, subscription_plans, app_policies,           │
│    site_settings, session, email_templates, detective_snippets, │
│    detective_visibility, claim_tokens, ...                     │
│  Raw / Supabase: payment_gateways, categories, tags, pages,     │
│    page_tags (CMS); Supabase migrations add detectives cols   │
│    and triggers (countries ref)                                │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
  Supabase (storage buckets), SendGrid/SMTP/SendPulse (email), Razorpay/PayPal (payments)
```

### 9.2 Flow Summary

- **Auth:** Login/register → session set → /api/auth/me used by client; protected routes use requireAuth/requireRole; client uses useAuth + withAuthProtection or useRequireAuth; 401/403 trigger handleSessionInvalid → redirect to /login.
- **Detective approval:** Application submitted → admin PATCH approved → user + detective created, FREE plan assigned where applicable, emails sent, application deleted.
- **Subscription/Blue Tick:** Create order (Razorpay or PayPal) → client pays → verify endpoint → mark payment_order paid → applyPackageEntitlements / Blue Tick logic → update detective row.
- **CMS:** Admin CRUD on categories, tags, pages (raw SQL); public reads via /api/public/pages; pages have optional banner_image, meta_title, meta_description (latter two on update only for create).

### 9.3 Problem List by Severity

| Severity   | Item |
|-----------|------|
| **Critical** | 1. Frontend calls non-existent `/api/user` (admin index + AdminLayout). 2. Supabase migrations reference `countries` and detectives columns not in app schema; trigger can fail. |
| **High**    | 3. Favorites stored in localStorage (conflict with “no data in browser local storage”). 4. `payment_gateways` not in Drizzle schema. 5. CMS tables not in Drizzle schema; two migration systems. |
| **Medium**  | 6. Drizzle _journal.json only has one migration. 7. Create page doesn’t accept meta_title/meta_description. 8. Email template routes use inline admin check instead of requireRole. |

---

**End of report. No code changes or fixes were applied; awaiting your confirmation before proposing any fixes.**
