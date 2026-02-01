# Phase 1: Database Schema vs Code Mismatch Audit

**Date:** 2025-01-30  
**Scope:** Read-only. No code changes, no migrations applied.  
**Baseline DB reference:** `supabase/migrations/20260129084218_remote_schema.sql` and later migrations in repo.

---

## 1. Executive Summary (Schema Health)

**Overall:** The application uses **two sources of truth**: (1) **Drizzle schema** in `shared/schema.ts` for most tables (detectives, users, services, reviews, orders, favorites, payment_orders, subscription_plans, etc.), and (2) **Raw SQL** for CMS (categories, tags, pages) and **payment_gateways**. The live database may lag the code if migrations have not been applied in order.

**Critical finding:** If the database was created from or last reset to `20260129084218_remote_schema.sql` and **later migrations were not applied**, the following **will fail at runtime**:

- **detectives:** Code reads and writes `blue_tick_addon`, `blue_tick_activated_at`, `has_blue_tick`. Remote schema has **none** of these columns. Result: `getDetective`, `getDetectiveByUserId`, `createDetective` (e.g. application approve), `updateDetectiveAdmin`, `searchServices` (JOIN detectives), ranking, and raw snippet query all fail (Postgres 42703 or write failure).
- **payment_orders:** Code reads/writes `provider`, `paypal_order_id`, `paypal_payment_id`, `paypal_transaction_id`, and treats `razorpay_order_id` as nullable. Remote has `razorpay_order_id` NOT NULL and no paypal/provider columns. Result: PayPal flows and any `select().from(paymentOrders)` or insert without razorpay_order_id fail.
- **payment_gateways:** Table does not exist in remote schema. Code uses raw SQL in `server/routes.ts`, `server/routes/paymentGateways.ts`, `server/services/paymentGateway.ts`. Result: GET/PUT payment gateways return 500.
- **pages (CMS):** Code reads and writes `banner_image`, `meta_title`, `meta_description`. Base CMS migration `20260130_add_cms_tables.sql` does **not** add these columns; `20260131_complete_cms_schema_setup.sql` does. If only base CMS is applied, create/update page with banner or SEO fields fails.

**Potential (non-fatal) mismatch:** `detective_visibility.visibility_score` — schema defines `decimal(10,4)`, remote defines `double precision`. Reads/writes generally work; type difference is informational.

---

## 2. Confirmed Schema Mismatches (Must Fix)

These are columns (or tables) that **code expects** but **do not exist** in the baseline remote schema. If your DB matches remote and these migrations are missing, runtime errors occur.

### 2.1 Table: `public.detectives`

| Column (code name) | DB column | Code usage | Read/Write | File(s) | Function / location |
|--------------------|-----------|-----------|------------|---------|----------------------|
| blueTickAddon | blue_tick_addon | SELECT, UPDATE, INSERT (via schema default) | Read, Write | server/storage.ts, server/routes.ts, server/services/entitlements.ts, server/ranking.ts (via schema) | getDetective, getDetectiveByUserId, createDetective (Drizzle full row), updateDetectiveAdmin, effectiveBadges; raw snippet query in routes.ts |
| blueTickActivatedAt | blue_tick_activated_at | SELECT, UPDATE | Read, Write | server/storage.ts, server/routes.ts, server/services/entitlements.ts | getDetective*, updateDetectiveAdmin, verify-blue-tick, applyPackageEntitlements |
| hasBlueTick | has_blue_tick | SELECT, UPDATE | Read, Write | server/storage.ts, server/routes.ts, server/services/entitlements.ts, server/services/subscriptionExpiry.ts; routes.ts raw query | getDetective*, updateDetectiveAdmin, effectiveBadges, applyPackageEntitlements; raw SELECT d.has_blue_tick, d.blue_tick_addon |

**Note:** Remote schema has no `blue_tick_addon`, `blue_tick_activated_at`, or `has_blue_tick`. Migrations that add them: `20260131_add_blue_tick_addon.sql`, `20260131_add_detectives_blue_tick_columns.sql`, and partially `20260130123345_add_new_tables_or_columns.sql` (adds only `blue_tick_activated_at` and `has_blue_tick`, not `blue_tick_addon`).

### 2.2 Table: `public.payment_orders`

| Column (code name) | DB column | Code usage | Read/Write | File(s) | Function / location |
|--------------------|-----------|-----------|------------|---------|----------------------|
| provider | provider | SELECT, INSERT (via InsertPaymentOrder) | Read, Write | server/storage.ts, shared/schema.ts | createPaymentOrder, getPaymentOrder*, markPaymentOrderPaid |
| paypalOrderId | paypal_order_id | SELECT, INSERT, UPDATE | Read, Write | server/storage.ts | getPaymentOrderByPaypalOrderId, createPaymentOrder, markPaymentOrderPaid |
| paypalPaymentId | paypal_payment_id | UPDATE | Write | server/storage.ts | markPaymentOrderPaid |
| paypalTransactionId | paypal_transaction_id | UPDATE | Write | server/storage.ts | markPaymentOrderPaid |
| packageId | package_id | Schema + raw SQL in admin-finance | Read, Write | shared/schema.ts, server/routes/admin-finance.ts | Inserts, JOINs |
| billingCycle | billing_cycle | Schema | Read, Write | shared/schema.ts | Inserts/updates |

**Constraint:** Schema has `razorpayOrderId` as optional (no .notNull()). Remote has `razorpay_order_id` NOT NULL. So: (1) If DB has NOT NULL, PayPal-only inserts (no razorpay_order_id) fail. (2) If columns above are missing, Drizzle SELECT/INSERT/UPDATE fail.

**Migration:** `20260130123345_add_new_tables_or_columns.sql` adds paypal columns, provider, and makes razorpay_order_id nullable.

### 2.3 Table: `public.pages` (CMS)

| Column (code) | DB column | Code usage | Read/Write | File(s) | Function / location |
|---------------|-----------|------------|-----------|---------|----------------------|
| bannerImage | banner_image | SELECT, INSERT, UPDATE | Read, Write | server/storage/cms.ts, server/routes/admin-cms.ts, server/routes/public-pages.ts, public-categories.ts, public-tags.ts | getPages, getPageById, createPage, updatePage; public page by slug |

| metaTitle | meta_title | SELECT, INSERT, UPDATE | Read, Write | server/storage/cms.ts, server/routes/admin-cms.ts, server/routes/public-pages.ts | getPages, getPageById, createPage, updatePage |
| metaDescription | meta_description | SELECT, INSERT, UPDATE | Read, Write | Same | Same |

**Note:** `20260130_add_cms_tables.sql` creates `pages` with only: id, title, slug, category_id, content, status, created_at, updated_at. `20260131_complete_cms_schema_setup.sql` adds banner_image, meta_title, meta_description. If the latter is not applied, any create/update that sets banner or SEO fields fails with "column does not exist".

### 2.4 Table: `public.payment_gateways`

**Entire table** is used by code but **does not exist** in `20260129084218_remote_schema.sql`. Code uses **raw SQL** only (no Drizzle schema in `shared/schema.ts`).

| Usage | Read/Write | File(s) | Location |
|-------|------------|---------|----------|
| SELECT payment_gateways | Read | server/routes.ts, server/routes/paymentGateways.ts, server/services/paymentGateway.ts | GET config, list gateways |
| UPDATE payment_gateways | Write | server/routes.ts | PUT admin payment gateways |

**Migration:** `20260130123345_add_new_tables_or_columns.sql` creates `payment_gateways`.

---

## 3. Potential Mismatches (Need Decision)

- **detective_visibility.visibility_score**  
  - **Schema:** `decimal("visibility_score", { precision: 10, scale: 4 })`.  
  - **Remote:** `double precision DEFAULT 0 NOT NULL`.  
  - **Code:** ranking.ts inserts `visibilityScore: "0"` and `String(score)`.  
  - **Risk:** Low. PostgreSQL coerces between numeric and float; no crash observed. Mark as **informational**; align type in a later migration if desired.

- **Migration order:** Multiple migrations add blue-tick–related columns (`20260131_add_blue_tick_addon.sql`, `20260131_add_detectives_blue_tick_columns.sql`, `20260130123345_add_new_tables_or_columns.sql`). If applied out of order or only partially, `blue_tick_addon` might still be missing. **Decision:** Ensure one canonical migration adds all three columns idempotently (e.g. IF NOT EXISTS).

---

## 4. Unused / Legacy DB Columns

Columns that **exist in DB** (from remote or migrations) but are **never written** by code, or **rarely/only historically read**. Not recommended for removal until product confirms.

### 4.1 Possibly legacy (read-only or deprecated in code)

| Table | Column | Notes |
|-------|--------|--------|
| detectives | subscription_plan | Schema and comments: READ-ONLY, legacy. Code still **reads** it (ranking.ts badge score, routes.ts safety logs, createDetective sets "free"). Never updated by payment flow. Marked "TODO: Remove in v3.0". |
| site_settings | logo_url, footer_links | Schema comments: legacy; footer_sections / header_logo_url etc. are preferred. Code may still read logo_url/footer_links in updateSiteSettingsSchema. |

### 4.2 Never written by code (may be unfinished or legacy)

| Table | Column | Notes |
|-------|--------|--------|
| billing_history | plan, payment_method, status, paid_at | Written via createBillingRecord(record); callers pass the record. If no route passes these fields, columns may remain null (possibly legacy or future use). |
| detective_visibility | visibility_score | **Written** by ranking.ts (ensureVisibilityRecord, update after score calc). So used. |
| search_stats | query, count, last_searched_at | Written by storage (recordSearch). Read by public routes for popular searches. Used. |

### 4.3 Possibly safe to remove later (after product sign-off)

- None identified with high confidence without tracing every insert/update. Recommendation: after Phase 1 migrations are applied, run a second pass to find columns with zero writes in code and zero reads in critical paths.

---

## 5. Missing Constraints (Informational)

Code assumptions that are **not** enforced by the current DB schema (no fixes proposed here).

| Expectation | Current DB (remote) | Risk |
|-------------|---------------------|------|
| One detective per user | Code often assumes single detective per userId (e.g. getDetectiveByUserId returns one). No UNIQUE on detectives(user_id) in remote. | Duplicate user_id possible; logic may assume one row. |
| detectives.user_id | FK exists (user_id → users.id). No UNIQUE. | Informational. |
| payment_orders: at least one of razorpay_order_id or paypal_order_id | Migration adds CHECK ((razorpay_order_id IS NOT NULL) OR (paypal_order_id IS NOT NULL)). Remote does not have it. | Without migration, invalid rows possible. |
| NOT NULL vs nullable | Code sometimes treats optional schema fields as present (e.g. effectiveBadges). Schema marks blue_tick_addon/has_blue_tick NOT NULL with default; if columns are missing, the issue is missing column, not nullability. | N/A once columns exist. |

---

## 6. Trigger / Function Dependencies

| Trigger / function | Table | Columns referenced | Code depends on side effect? |
|--------------------|--------|--------------------|------------------------------|
| update_detective_visibility_timestamp | detective_visibility | updated_at | No. Code does not rely on trigger to set updated_at; it’s a convenience. |
| detectives_iso_enforce | detectives | None (no-op body) | No. Comment: "No-op; detectives table has no signup_country_id/signup_country_iso2". |
| update_payment_gateways_updated_at | payment_gateways | updated_at | No. Same as above. |
| update_timestamp (categories, tags, pages) | categories, tags, pages | updated_at | No. CMS code does not depend on trigger for correctness. |

**Conclusion:** No code path depends on trigger-only column values. Missing triggers would only affect automatic updated_at; no crash risk from trigger/function schema mismatch except if a trigger referenced a **missing column** (currently none do).

---

## 7. Runtime Crash Risks (Ordered by Severity)

| # | Mismatch | Severity | Condition | Effect |
|---|----------|----------|-----------|--------|
| 1 | detectives missing blue_tick_addon, blue_tick_activated_at, has_blue_tick | **Critical** | DB without these columns | getDetective, getDetectiveByUserId → 42703 or empty; createDetective (application approve) → write failure; searchServices, ranking, snippet query → 500 / wrong results. |
| 2 | payment_orders missing paypal/provider columns; razorpay_order_id NOT NULL | **Critical** | DB without migration 20260130123345 payment_orders changes | PayPal create/verify/capture fails; getPaymentOrderByPaypalOrderId fails; Drizzle select/insert uses schema and fails. |
| 3 | payment_gateways table missing | **High** | DB without payment_gateways table | GET/PUT admin payment gateways 500; payment gateway service 500. |
| 4 | pages missing banner_image, meta_title, meta_description | **High** | CMS base applied, complete_cms_schema_setup not applied | createPage/updatePage with banner or SEO fields → "column does not exist". Public page reads return undefined for those fields (no crash). |
| 5 | detective_visibility.visibility_score type (decimal vs double precision) | **Low** | Any | No crash observed; possible minor precision difference. |

---

## 8. Ordered Fix List for Phase 1 ONLY

Apply in this order, **after** confirmation. No migrations are generated or applied in this audit.

1. **detectives:** Add columns `blue_tick_addon` (BOOLEAN NOT NULL DEFAULT false), `blue_tick_activated_at` (TIMESTAMP WITH TIME ZONE nullable), `has_blue_tick` (BOOLEAN NOT NULL DEFAULT false). Use a single idempotent migration (e.g. ADD COLUMN IF NOT EXISTS) so it is safe regardless of which of the existing blue-tick migrations have already run.
2. **payment_orders:** Add columns `provider`, `paypal_order_id`, `paypal_payment_id`, `paypal_transaction_id` (as in schema); add `package_id`, `billing_cycle` if not present; alter `razorpay_order_id` to allow NULL (for PayPal-only orders); add CHECK constraint so at least one of razorpay_order_id or paypal_order_id is NOT NULL.
3. **payment_gateways:** Ensure table exists (full definition from migration 20260130123345 or equivalent), including triggers/constraints.
4. **pages (CMS):** Add columns `banner_image` (TEXT or VARCHAR), `meta_title` (VARCHAR(255)), `meta_description` (TEXT) if not present.
5. **detective_visibility.visibility_score:** Optional. Align type to schema (e.g. NUMERIC(10,4)) in a separate migration if desired; low priority.

---

**Phase 1 audit complete. Awaiting confirmation to generate migrations.**
