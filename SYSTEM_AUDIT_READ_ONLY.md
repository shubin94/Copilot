# System Audit — Read-Only Comprehension

This document is a structured explanation of the codebase for comprehension only. No code changes, suggestions, or fixes.

---

## 1. Overall Architecture and Data Flow

### 1.1 Stack and layout

- **Monorepo**: Single repo with shared code. Vite builds the client; Node (Express) serves API and (in dev) Vite middleware; in production serves static build from `dist/public`.
- **Backend**: Express in `server/`. Entry: `index-dev.ts` (dev + Vite) or `index-prod.ts` (static). `app.ts` sets up middleware (JSON, helmet, compression, rate limit on `/api/auth/` in prod), **session** (PG or memory), **CSRF** (origin/referer + `X-Requested-With: XMLHttpRequest` for POST/PUT/PATCH/DELETE), and request logging. `registerRoutes(app)` in `routes.ts` mounts all API routes and returns the HTTP server.
- **Database**: PostgreSQL via **Drizzle** (`db/index.ts`, pool). Schema and Zod validation live in `shared/schema.ts`. Migrations in `migrations/*.sql` (Drizzle journal in `meta/`). Raw SQL used for CMS (categories, tags, pages) via `pool` in `server/storage/cms.ts`; `payment_gateways` is also raw SQL in `server/services/paymentGateway.ts`.
- **Frontend**: React 18, **Wouter** for routing, **TanStack Query** for server state. `client/src/App.tsx` wraps the app in `QueryClientProvider`, `UserProvider`, `CurrencyProvider`, `TooltipProvider`, and initializes auth session (interceptor, cross-tab logout, optional idle timeout). No global Redux; user and favorites live in `UserContext`; everything else is React Query or local state.
- **Auth**: Session-based. Session store is PG (`session` table via `connect-pg-simple`) or in-memory in dev. Session holds `userId` and `userRole`. Cookies are httpOnly, sameSite lax, configurable TTL and secure in prod. No JWT in normal flow.

### 1.2 Request path (frontend → backend → DB)

1. **UI** calls `api.*` in `client/src/lib/api.ts` (or raw `fetch` on some admin/CMS pages). All mutation methods use `csrfFetch`, which adds `X-Requested-With: XMLHttpRequest` and `credentials: "include"`.
2. **Express** receives the request: CSRF check (origin/referer + header), then route handler. Auth is enforced with `requireAuth` (any logged-in user) or `requireRole("detective"|"admin")` (session `userRole`).
3. **Handlers** in `server/routes.ts` (and mounted sub-routers) validate body with Zod schemas from `shared/schema.ts`, call **storage** (`server/storage.ts`), and respond with JSON. Storage is the single `DatabaseStorage` implementation; it uses Drizzle and `db` from `db/index.ts`.
4. **Side effects**: File storage (Supabase) for uploads; SendPulse/Resend for email; Razorpay/PayPal for payments; subscription expiry runs on a daily timer (2 AM) in `app.ts` via `handleExpiredSubscriptions()`.

---

## 2. Auth, Roles, Permissions, Session

### 2.1 Roles and where they’re enforced

- **user**: Default. Can register, login, browse, place orders, add reviews, use “favorites” (client-only), claim account with token.
- **detective**: Has an associated `detectives` row (via `userId`). Can manage own profile, services, view orders/reviews, pay for subscription/blue tick. Enforced by `requireRole("detective", "admin")` on detective-specific and payment routes.
- **admin**: Full access: users, detectives (CRUD, reset password, delete account), applications, claims, service categories, site settings, visibility, snippets, email templates, payment gateways, CMS (categories, tags, pages), finance. Enforced by `requireRole("admin")` or CMS `requireAdmin` (session check in `admin-cms.ts`).

Session is the only source of “who is logged in” and “which role”. No role checks in the frontend beyond guarding routes (e.g. admin/detective pages); the backend always re-checks.

### 2.2 Session lifecycle

- **Login**: `POST /api/auth/login` (bcrypt compare, then `req.session.userId` / `userRole` set). Response includes user (and optional applicant status).
- **Logout**: `POST /api/auth/logout` destroys session. Frontend also calls `handleSessionInvalid('manual_logout')`: clears React Query cache, localStorage (favorites, auth_state), sessionStorage, sets `logout_event` in localStorage, then `window.location.replace('/login')`.
- **401/403**: `authSessionManager.ts` overrides `window.fetch`. On 401/403 (except on `/api/auth/me` and on public paths), it calls `handleSessionInvalid` after a short delay, which clears cache and redirects to `/login`. Cross-tab: `storage` listener on `logout_event` clears cache and redirects. Optional auth monitor (disabled in App) and optional idle timeout.

### 2.3 Assumptions

- Session cookie is the single source of truth for auth; no stateless tokens.
- CSRF relies on same-origin or allowed origins plus `X-Requested-With`.
- “Public” paths are hardcoded in the interceptor and in auth monitor; new routes must be added there if they should not trigger redirect on 401.

---

## 3. State Management and Caching

### 3.1 React Query

- **QueryClient** (`client/src/lib/queryClient.ts`): default `staleTime: Infinity`, `refetchOnWindowFocus: false`, `retry: false`. Global mutation `onError` calls `handleSessionInvalid` on 401/403-like errors.
- **Hooks** (`client/src/lib/hooks.ts`): One hook per main entity or list (e.g. `useAuth`, `useDetective`, `useServices`, `useServiceCategories`). Query keys are arrays like `["auth","me"]`, `["detectives", id]`, `["services", "detective", detectiveId]`, `["serviceCategories", activeOnly]`.
- **Mutations** (create/update/delete) call `queryClient.invalidateQueries({ queryKey: [...] })` in `onSuccess`. Invalidation is key-prefix based: e.g. `["services"]` invalidates all queries whose key starts with `["services"]`, so lists and detail caches can refetch. Some mutations also **setQueryData** optimistically (e.g. admin create service for detective).

### 3.2 Other state

- **UserContext**: Holds `user` (from `useAuth().data?.user`), `favorites` (array of IDs in React state + mirrored in `localStorage` key `favorites`), `isFavorite(id)`, `toggleFavorite(serviceId)`, `logout`. Favorites are **not** sent to the server on toggle; they are client-only. The backend has `getFavoritesByUser`, `addFavorite`, `removeFavorite` (by `userId` + `serviceId`), but no UI uses `useAddFavorite`/`useRemoveFavorite`; the favorites page and service cards only read/write UserContext + localStorage.
- **CurrencyProvider**: Country/currency preferences for display (and possibly API params); separate from auth.

### 3.3 HTTP caching (backend)

- Some GETs use `sendCachedJson`: ETag from SHA1 of JSON body; if `If-None-Match` matches, 304. Used for public detective, user, services list, service categories, popular categories. Also `Cache-Control` headers (e.g. `public, max-age=60, stale-while-revalidate=300`) on some routes. No Redis or app-level cache; only DB and HTTP caching.

---

## 4. Core Entities and Relationships

### 4.1 Main schema (Drizzle in `shared/schema.ts`)

- **users**: id, email, password, name, role (user|detective|admin), avatar, preferredCountry, preferredCurrency, mustChangePassword, timestamps. Source of truth for login and role.
- **detectives**: userId (FK → users), business/profile fields, location (country, state, city), subscription fields (subscriptionPackageId, billingCycle, expires, pending downgrade), hasBlueTick, status (pending|active|suspended|inactive), level, isVerified, isClaimed, claimCompletedAt, etc. One detective per user. Subscription “plan” is driven by subscriptionPackageId (+ subscription_plans); legacy subscriptionPlan text is read-only.
- **services**: detectiveId (FK → detectives), category, title, description, basePrice, offerPrice, images[], isActive, viewCount, orderCount. One detective has many services.
- **service_packages**: serviceId (FK → services), name, description, price, features, deliveryTime, tierLevel.
- **reviews**: serviceId, userId, orderId (optional), rating, comment, isPublished.
- **orders**: serviceId, packageId, userId, detectiveId, amount, status (pending|in_progress|completed|cancelled|refunded), requirements, deliveryDate, completedAt.
- **favorites**: userId, serviceId (unique pair). Backend source of truth; frontend does not sync to it on heart toggle.
- **detective_applications**: Signup form data; status (pending|under_review|approved|rejected); on approval a user + detective can be created.
- **profile_claims**: detectiveId, claimant details, documents, status; claim-account flow links a user to an unclaimed detective.
- **claim_tokens**: detectiveId, tokenHash, expiresAt, usedAt; used for secure claim links.
- **payment_orders**: userId, detectiveId, plan, packageId, billingCycle, amount, currency, provider, razorpay/paypal IDs, status. Used for subscription and blue-tick payments.
- **subscription_plans**: name, displayName, monthly/yearly price, features[], badges (e.g. blueTick), serviceLimit, isActive. Detectives reference by subscriptionPackageId.
- **service_categories**: name, description, isActive. Used for service taxonomy (main app).
- **site_settings**: Single-row (logo URLs, footer sections, social links, copyright). Fetched for branding.
- **app_policies**: key-value (e.g. pagination defaults, visibility rules). Validated at startup.
- **detective_visibility**: detectiveId, isVisible, isFeatured, manualRank, visibilityScore, lastEvaluatedAt. Used for ranking.
- **detective_snippets**: name, country, state, city, category, limit. Admin-defined snippets for “detective” blocks.
- **email_templates**: key, name, subject, body, sendpulseTemplateId, isActive.
- **session**: sid, sess (JSON), expire. Session store table.
- **billing_history**, **search_stats**: Supporting tables.

### 4.2 CMS (separate storage)

- **storage/cms.ts** + **pool**: Tables `categories`, `tags`, `pages`, `page_tags` (raw SQL). Categories/tags have slug and status (published|draft|archived). Pages have content (block JSON), banner_image, meta, category_id. CMS is used for blog-like pages and blocks; public routes in `public-pages.ts` and `public-categories.ts`, `public-tags.ts`.

### 4.3 Payment gateways

- **payment_gateways** (migration 0020): name, display_name, is_enabled, is_test_mode, config (JSONB). Fetched in `server/services/paymentGateway.ts`; Razorpay/PayPal in routes use DB config when enabled, else env fallback.

---

## 5. Source of Truth and Side Effects

### 5.1 Source of truth

- **User identity and role**: `users` + session (session is authoritative for the request).
- **Detective profile and subscription**: `detectives` (+ joined `subscription_plans`). subscriptionPackageId and expiry drive entitlements; hasBlueTick is set by `applyPackageEntitlements` (and blue-tick verification), not by arbitrary admin edit in some code paths.
- **Services, reviews, orders, favorites (server)**: Their respective tables. Favorites UI source of truth is actually localStorage + UserContext, not the DB.
- **Service categories (main app)**: `service_categories` table. Admin can create/update/delete (hard delete in storage).
- **CMS content**: `categories`, `tags`, `pages` in CMS DB. Admin CMS routes create/update/delete (category “delete” is soft: status → archived).
- **Site settings**: `site_settings` single row. Admin PATCH updates.
- **Visibility/ranking**: `detective_visibility`; ranking.ts computes visibilityScore from level, badges, activity, reviews; manualRank overrides.

### 5.2 Side effects on write

- **Detective create**: Assigns default subscription (free plan via getFreePlanId), optionally uploads logo to Supabase.
- **Service create/update**: May upload images (data URLs → Supabase `service-images` bucket). Service delete deletes Supabase images then DB row.
- **Detective delete (admin)**: Deletes Supabase assets (logo, documents, all service images), then storage.deleteDetectiveAccount (orders, profile_claims, detective_applications by email, then users row; detectives go via FK cascade).
- **Payment verify (Razorpay/PayPal)**: Updates payment_orders status, sets detective subscriptionPackageId, billingCycle, subscriptionActivatedAt, subscriptionExpiresAt, calls applyPackageEntitlements (e.g. hasBlueTick from plan badges). Blue-tick verification sets hasBlueTick/blueTickActivatedAt.
- **Claim approve**: Can create user + detective, set claimCompletedAt, send email, invalidate token.
- **Application approve**: Creates user (hashed password) and detective, can send email.
- **Subscription expiry job**: Finds detectives with subscriptionExpiresAt &lt; NOW and non-free packageId; sets them to free plan (subscriptionPackageId, clears expiry/pending).

---

## 6. CREATE / UPDATE / DELETE Flows (End-to-End)

### 6.1 Service

- **Create**: Frontend (e.g. detective services page) calls `api.services.create(data)`. Handler POST `/api/services` (requireRole detective), validates with insertServiceSchema, uploads images to Supabase, storage.createService. React Query: useCreateService invalidates `["services"]`; detective page also invalidates `["services", "detective", detectiveId]` and `["services", result.service.id]`. UI updates when those queries refetch.
- **Update**: PATCH `/api/services/:id`, requireRole detective/admin, ownership check for non-admin. storage.updateService (whitelisted fields). useUpdateService invalidates `["services", id]` and `["services"]`. Detective services page invalidates detective list and detail.
- **Delete**: DELETE `/api/services/:id`, requireRole detective/admin. Supabase images removed, storage.deleteService. useDeleteService invalidates `["services"]`. Detective services page invalidates `["services", "detective", detectiveId]` and `["services", "all"]`. List refetches and the deleted service disappears.

### 6.2 Detective (admin delete)

- **Delete**: DELETE `/api/admin/detectives/:id`, requireRole admin. Removes Supabase assets (detective + all their services), then storage.deleteDetectiveAccount (orders, profile_claims, detective_applications by email, then users). Response 200. useAdminDeleteDetective invalidates `["detectives", "all"]`, `["applications"]` (and status keys). Admin list refetches; if the admin stays on a detail page for that detective, that query is not explicitly invalidated by key (only by prefix `["detectives"]`), so it may refetch when remounted or when list refetch triggers usage.

### 6.3 Service category (main app)

- **Create**: POST `/api/service-categories`, requireRole admin, insertServiceCategorySchema, storage.createServiceCategory. useCreateServiceCategory invalidates all serviceCategories keys (true/false/undefined).
- **Update**: PATCH `/api/service-categories/:id`, updateServiceCategorySchema, storage.updateServiceCategory. useUpdateServiceCategory invalidates serviceCategories keys.
- **Delete**: DELETE `/api/service-categories/:id`, storage.deleteServiceCategory (hard delete). useDeleteServiceCategory: removes the category from all cached category lists via setQueryData (filter by id), then invalidates `["serviceCategories"]`. So the item disappears from UI without waiting for refetch.

### 6.4 Review

- **Create**: POST `/api/reviews`, requireAuth, insertReviewSchema; if user already reviewed that service, update instead. useCreateReview invalidates `["reviews"]`.
- **Update**: PATCH `/api/reviews/:id`, ownership or admin. useUpdateReview invalidates `["reviews", id]` and `["reviews"]`.
- **Delete**: DELETE `/api/reviews/:id`, ownership or admin. useDeleteReview invalidates `["reviews"]`. No per-service key invalidation in the hook; any list showing reviews for a service would need to be under a key that gets invalidated (e.g. `["reviews", "service", serviceId]`) or refetched when the list query is invalidated.

### 6.5 Favorites (backend vs frontend)

- **Backend**: GET `/api/favorites` (requireAuth), POST `/api/favorites` (body serviceId), DELETE `/api/favorites/:serviceId`. Storage: getFavoritesByUser, addFavorite(InsertFavorite), removeFavorite(userId, serviceId). These are the source of truth in DB.
- **Frontend**: UserContext’s `toggleFavorite(serviceId)` only updates React state and localStorage; it does **not** call the favorites API. So create/update/delete of favorites in the UI are client-only. Favorites page and service cards use UserContext; they never call useAddFavorite/useRemoveFavorite. If the user logs in from another device, favorites from the server would not match the device’s localStorage.

### 6.6 CMS category (admin)

- **Create**: POST `/api/admin/categories` (admin-cms router), body name, slug, status. createCategory in storage/cms.ts. Admin categories page uses raw fetch and invalidates `["/api/admin/categories"]` on success.
- **Update**: PATCH `/api/admin/categories/:id`, updateCategory.
- **Delete**: DELETE `/api/admin/categories/:id` → updateCategory(id, undefined, "archived") (soft delete). Same invalidation.

---

## 7. Why Data Might Persist in UI Until Refresh

- **Invalidation is key-based**: If a mutation invalidates `["services"]` but a screen uses a key like `["services", "search", params]`, that query is invalidated (prefix match). If a screen uses a key that is never invalidated (e.g. a detail key that no mutation touches), the cache stays until the query is refetched (e.g. window focus, remount, or manual refetch). So “stale until refresh” usually means either the mutation’s invalidation doesn’t cover that key or the component doesn’t remount/refetch.
- **Optimistic vs refetch**: Most mutations don’t set optimistic data; they invalidate and rely on refetch. Refetch is async; until it finishes, the UI shows previous data. If refetch fails or the key isn’t invalidated, old data persists.
- **Favorites**: Favorites list is purely from UserContext + localStorage. No refetch from server; so “persist until refresh” doesn’t apply in the same way—what persists is whatever is in state/localStorage until the user toggles again or logs out (which clears it).
- **HTTP caching**: Responses that use sendCachedJson or Cache-Control can be reused by the browser. So a GET that was cached might show old data until cache is bypassed or expires. Mutations don’t clear browser HTTP cache.
- **Admin CMS vs main app**: Admin CMS categories use query key `["/api/admin/categories"]` and their own fetch; main app service categories use `["serviceCategories", activeOnly]`. They are separate; invalidating one doesn’t affect the other.

---

## 8. File-by-File Responsibility Map

### 8.1 Root / config

- **package.json**: Scripts (dev, build, start, reset-auth, db:audit); dependencies (Express, Drizzle, React, TanStack Query, Supabase, PayPal, Razorpay, etc.).
- **tsconfig.json**: Include client, shared, server; path aliases @/*, @shared/*, @db.
- **vite.config.ts**: Root = client, build outDir = dist/public; aliases; dev server; optional Replit plugins.
- **drizzle.config.ts**: (If present) Drizzle migration/config.
- **.env / .env.example**: DATABASE_URL, SESSION_SECRET, SUPABASE_*, CSRF_ALLOWED_ORIGINS, email and payment env vars.

### 8.2 Backend

- **server/app.ts**: Express app creation, JSON/urlencoded, helmet, compression, auth rate limit, session middleware (PG or memory), CSRF middleware, request logging, runApp(setup) → registerRoutes then setup (Vite or static), global error handler, subscription expiry scheduler (2 AM daily).
- **server/config.ts**: Reads NODE_ENV, PORT, DATABASE_URL, SESSION_*, CSRF, email, Supabase, Razorpay, PayPal; validateConfig() for prod.
- **server/index-dev.ts**: validateDatabase(), runApp(setupVite), Vite middleware + catch-all to index.html.
- **server/index-prod.ts**: validateConfig (prod), validateDatabase(), runApp(serveStatic), serve dist/public and fallback to index.html.
- **server/startup.ts**: validateDatabase() — checks app_policies and site_settings row.
- **server/routes.ts**: registerRoutes(app): defines requireAuth, requireRole, helpers (getServiceLimit, maskDetectiveContactsPublic, applyPackageEntitlements, applyPendingDowngrades, sendCachedJson), mounts paymentGateways, adminCms, adminFinance, publicPages, publicCategories, publicTags; defines all auth, user, detective, service, review, order, favorites, applications, claims, claim-account, email templates, billing, service-categories, site-settings, health, dev audit, visibility, snippets, payment-gateways routes; creates HTTP server. Single large file; all route handlers and payment/entitlement logic live here.
- **server/storage.ts**: IStorage interface and DatabaseStorage class. Implements all DB access for users, detectives, services, reviews, orders, favorites, applications, claims, billing, service categories, site settings, subscription plans, payment orders, visibility (via ranking), snippets (via db.select/insert/update/delete on detectiveSnippets), email templates, and admin operations (deleteDetectiveAccount, getPublicServiceCountByDetective, etc.). Exports singleton `storage` (with optional fallbacks for some methods). Source of truth for how entities are read/written.
- **server/storage/cms.ts**: CMS CRUD using pool (raw SQL): categories, tags, pages, page_tags; createPage, updatePage, deletePage, etc. Used only by admin-cms and public-pages routes.
- **server/supabase.ts**: createClient(SUPABASE_URL, SERVICE_ROLE_KEY); ensureBucket; parsePublicUrl; deletePublicUrl; uploadDataUrl; uploadFromUrlOrDataUrl. Used for all server-side file storage.
- **server/policy.ts**: getPolicy(key), requirePolicy(key) from app_policies table.
- **server/ranking.ts**: calculateVisibilityScore (manual rank, level, badges, activity, reviews), getRankedDetectives; used by routes for sorting services and visibility.
- **server/email.ts**: sendClaimApprovedEmail (and any other email helpers).
- **server/routes/admin-cms.ts**: Router mounted at /api/admin. requireAdmin (session). GET/POST/PATCH/DELETE categories, tags, pages; upload content images to Supabase; uses storage/cms.ts and pool.
- **server/routes/admin-finance.ts**: Mounted at /api/admin/finance. Finance-specific admin routes (if any).
- **server/routes/public-pages.ts**: Mounted at /api/public/pages. GET by category/slug or slug; fetchPage from pool; returns page with category and tags.
- **server/routes/public-categories.ts**, **public-tags.ts**: Public read for CMS categories/tags.
- **server/routes/paymentGateways.ts**: Admin CRUD/toggle for payment_gateways (likely GET/PUT/POST toggle).
- **server/services/paymentGateway.ts**: getPaymentGateway(name), getEnabledPaymentGateways(), isPaymentGatewayEnabled(); reads payment_gateways via pool.
- **server/services/paypal.ts**: createPayPalOrder, capturePayPalOrder, verifyPayPalCapture; used in routes for subscription and blue-tick.
- **server/services/subscriptionExpiry.ts**: handleExpiredSubscriptions (downgrade expired to free), checkDetectiveExpiry.
- **server/services/freePlan.ts**: getFreePlanId(), ensureDetectiveHasPlan(); used so every detective has a subscriptionPackageId.
- **server/services/claimTokenService.ts**: generateClaimToken, calculateTokenExpiry, buildClaimUrl; used in claim flow.
- **server/services/sendpulseEmail.ts**, **resendEmail.ts**, **emailTemplateService.ts**: Email sending and template resolution.

### 8.3 Database and shared

- **db/index.ts**: Creates pg Pool, drizzle(pool, { schema }), exports db and pool. No migrations run here; migrations are separate.
- **shared/schema.ts**: Drizzle table definitions and Zod insert/update schemas for all main entities; type exports. Single source of schema for backend and shared types.
- **shared/content-blocks.ts**: (In client/src/shared) Block types and parse/stringify for CMS content; used by server admin-cms and client render-blocks.

### 8.4 Frontend — core

- **client/src/main.tsx**: Renders App into root.
- **client/src/App.tsx**: useEffect to initializeAuthSession (interceptor, cross-tab, auth monitor off). Router with Switch/Route for all paths (public, admin, detective, user, CMS, 404). Lazy-loaded page components; ScrollToTop, CountrySelectorPopup, SmokeTester.
- **client/src/lib/api.ts**: csrfFetch wrapper (adds X-Requested-With for mutations); handleResponse; api.get/post/put/delete; api.auth.*, api.detectives.*, api.services.*, api.reviews.*, api.orders.*, api.favorites.* (add/remove use (userId, detectiveId) in signature but backend expects serviceId), api.applications.*, api.claims.*, api.serviceCategories.*, api.settings.*, api.catalog.*. All API calls go through here (except some admin/CMS pages that use raw fetch).
- **client/src/lib/queryClient.ts**: QueryClient with default options; getQueryFn; handleSessionInvalid on mutation auth errors.
- **client/src/lib/hooks.ts**: useQuery/useMutation wrappers for auth, detectives, services, reviews, orders, favorites, users, applications, claims, service categories, site settings, popular categories; each mutation invalidates the relevant query keys.
- **client/src/lib/authSessionManager.ts**: handleSessionInvalid (clear cache, localStorage, sessionStorage, redirect to /login); createAuthInterceptor (override fetch on 401/403); setupCrossTabLogout (storage event); startAuthMonitor; setupIdleTimeout; initializeAuthSession. Used by App and queryClient.
- **client/src/lib/user-context.tsx**: UserProvider: useAuth for user; favorites state + localStorage (no API sync on toggle); isFavorite, toggleFavorite (local only), logout (api.auth.logout + handleSessionInvalid).
- **client/src/lib/authProtection.tsx**: (If present) Route guard component for protected routes.
- **client/src/lib/currency-context.tsx**: CurrencyProvider, country/currency for display.
- **client/src/lib/geo.ts**, **country-currency-map.ts**, **world-countries.ts**: Geo/country data.

### 8.5 Frontend — pages and components

- **client/src/pages/** : One file per route: home, login, detective-signup, detective profile (public), detective dashboard/services/reviews/subscription/billing/settings, user dashboard/favorites, admin dashboard/detectives/services/categories/claims/signups/subscriptions/settings/branding/ranking/email-templates/snippets/payment-gateways, admin CMS (index, categories, tags, pages-edit, page-edit), search, categories, claim-account, claim-profile, page-view, page-category, page-tag, static (about, privacy, terms, contact, blog, support, packages), not-found. Each page uses hooks and/or api and optionally local state; admin categories (CMS) use raw fetch and query key `["/api/admin/categories"]`.
- **client/src/components/layout**: navbar, footer, dashboard-layout; AdminLayout, footer-cms.
- **client/src/components/home**: hero, service-card, service-card-skeleton. Service card uses UserContext for favorites (toggleFavorite(service.id)); no API.
- **client/src/components/content-editor**: block-editor, heading/paragraph/image/video/shortcode blocks for CMS.
- **client/src/utils/render-blocks.tsx**: Renders CMS content blocks to React.
- **client/src/pages/detective/services.tsx**: useCurrentDetective, useQuery for services by detective, useMutation create/update/delete with invalidations for `["services", "detective", detectiveId]`, `["services", "all"]`, and per-service key where applicable.
- **client/src/pages/admin/services.tsx**: useServices, useDetectives, useServiceCategories, useCreateService, useUpdateService, useDeleteService from hooks; same invalidation pattern.
- **client/src/pages/admin/categories.tsx**: CMS categories; raw fetch to /api/admin/categories; invalidates `["/api/admin/categories"]`.

### 8.6 Migrations and scripts

- **migrations/*.sql**: Schema changes (tables, indexes, enums); applied out-of-band (e.g. drizzle-kit or scripts). 0020 adds payment_gateways.
- **scripts/*.ts**: One-off or dev scripts (seed, migrate, check, reset-auth, etc.); not part of runtime.

---

## 9. Assumptions (Explicit and Implicit)

### 9.1 Backend

- DATABASE_URL and (in prod) SESSION_SECRET, SUPABASE_*, HOST are set; production also requires email config (SendGrid/SMTP/SendPulse) and Razorpay keys (or DB payment_gateways).
- Session store table `session` exists (createTableIfMissing: true for PG store).
- All detectives must have a subscriptionPackageId; getFreePlanId() returns a valid free plan; ensureDetectiveHasPlan is used on getDetective when subscriptionPackageId is null.
- Subscription and blue-tick entitlements are applied only through payment verification and applyPackageEntitlements; hasBlueTick can also be set by blue-tick verification flow. Legacy subscriptionPlan is not written by business logic.
- Payment gateways table may be missing; code falls back to env and logs.
- CMS tables (categories, tags, pages, page_tags) exist when using CMS routes; schema may be created by separate migration/script.
- deleteServiceCategory is a hard delete; CMS category “delete” is soft (archived). deleteDetectiveAccount deletes the user (and cascade removes detective and related).

### 9.2 Frontend

- API base is same origin (relative URLs like /api/...); credentials: "include" sends session cookie.
- CSRF: All mutation requests must send X-Requested-With: XMLHttpRequest and come from an allowed origin. csrfFetch in api.ts adds the header.
- User is always from useAuth(); UserProvider is above any component that uses useUser(). Favorites are client-only; no assumption that server and client favorites are in sync.
- Query keys are consistent between hooks and mutation invalidations; pages that use custom keys (e.g. `/api/admin/categories`) must invalidate those same keys.
- Protected routes are enforced by backend; frontend route guards only redirect; 401/403 trigger full logout and redirect via authSessionManager.

### 9.3 Data

- Favorites in DB are (userId, serviceId). The client api.favorites.add(userId, detectiveId) is misnamed (second arg is serviceId on backend). The UI does not call these endpoints for heart toggle; it only uses UserContext + localStorage.
- Service categories (main app) and CMS categories are different systems; different tables and different admin UIs.
- Ranking/visibility: detective_visibility.manualRank overrides computed visibilityScore; isVisible=false hides the detective from ranking regardless of score.

---

## 10. Summary

The app is a full-stack private-detective directory: users browse detectives and services, place orders, leave reviews; detectives manage profile and services and pay for subscriptions; admins manage users, detectives, applications, claims, categories, site settings, CMS, and payment gateways. Auth is session-based with role checks on the server. State is React Query plus UserContext (and localStorage for favorites). Mutations invalidate query keys so lists and details refetch; favorites in the UI are not persisted to the server on toggle. CREATE/UPDATE/DELETE flows go through Express → storage (Drizzle or CMS pool) → DB (and optionally Supabase, email, payment providers). Data can persist in the UI until refresh when invalidation doesn’t cover the key in use or when refetch hasn’t completed or when the UI relies on client-only state (e.g. favorites) that is never synced to the server.
