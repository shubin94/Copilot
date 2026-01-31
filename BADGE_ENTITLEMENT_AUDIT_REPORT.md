# Badge Entitlement Logic — Read-Only Audit Report

**Scope:** Blue Tick, Pro, Recommended badges vs subscription entitlements.  
**Rules:** No code changes; infer behavior from code only.

---

## 1) Expected behavior (inferred from code)

- **Backend (routes.ts comments):** Badges are intended to be derived from `subscription_packages.badges`; `applyPackageEntitlements` is documented as the only place that grants/revokes `hasBlueTick` from package badges. Subscription activation should apply entitlements; expiry/downgrade should remove badges.
- **Detective table:** Stores `hasBlueTick`, `blueTickActivatedAt`, `isVerified`. There are **no** stored columns for Pro or Recommended; those are intended to be derived from the active package’s `badges` at read time.
- **Subscription plans:** `subscription_plans.badges` (jsonb) is the entitlement source (e.g. `{ blueTick: true, pro: true, recommended: true }`).
- **Blue Tick:** Can be granted by (1) package `badges.blueTick === true` via `applyPackageEntitlements`, or (2) separate Blue Tick purchase via `verify-blue-tick` / PayPal capture for `blue-tick` package (sets `hasBlueTick` directly). When package does not include `blueTick`, `applyPackageEntitlements` clears `hasBlueTick`.

---

## 2) Actual behavior

- **Blue Tick:** Stored on detective (`has_blue_tick`). Synced from package only when `applyPackageEntitlements` runs (payment activation). **Not** cleared when subscription expires (expiry job does not call `applyPackageEntitlements`). Shown in UI when `hasBlueTick && subscriptionPackageId` (any package, including FREE).
- **Pro / Recommended:** Not stored; UI derives from `detective.subscriptionPackage?.badges`. Shown only where the API returns `subscriptionPackage` (e.g. GET `/api/services/:id`). **Not** shown in search/home listing because `searchServices` does not join `subscription_plans`, so `subscriptionPackage` is undefined there.
- **Subscription expiry:** `subscriptionExpiry.ts` sets `subscriptionPackageId = freePlanId`, clears expiry/pending, but **does not** call `applyPackageEntitlements`. So `hasBlueTick` is never cleared on expiry.
- **Subscription status (active/expired):** APIs return detective with whatever `subscriptionPackageId` and joined `subscriptionPackage` (when joined). No backend logic strips or adjusts badges based on `subscriptionExpiresAt` before sending. Expiry is only applied by the scheduled job that runs later.

---

## 3) Per-badge analysis

### Blue Tick

| Aspect | Detail |
|--------|--------|
| **Stored** | `detectives.has_blue_tick`, `detectives.blue_tick_activated_at` |
| **Derived** | No; stored state. Intended to be synced from package by `applyPackageEntitlements` when package has `badges.blueTick === true`, or set by Blue Tick payment flows. |
| **Granted** | (1) Payment verify (Razorpay/PayPal) for regular package with `blueTick` in badges → `applyPackageEntitlements` sets `hasBlueTick = true`. (2) Blue Tick add-on payment (`blue-tick` / `blue_tick_addon`) → direct `updateDetectiveAdmin({ hasBlueTick: true })`; `applyPackageEntitlements` not called. |
| **Revoked** | Only inside `applyPackageEntitlements` when `packageBadges.blueTick !== true` (e.g. FREE or package without blueTick). `applyPackageEntitlements` is **only** called on payment verification (activation), **not** on expiry or downgrade. |
| **Expiry/downgrade** | Subscription expiry job updates `subscriptionPackageId` to FREE but does **not** call `applyPackageEntitlements`. So `hasBlueTick` remains true after expiry until some other activation runs. |
| **UI condition** | `detective.hasBlueTick && detective.subscriptionPackageId`. Any non-null package (including FREE) satisfies the second part, so Blue Tick can still show after downgrade to FREE if `hasBlueTick` was not cleared. |

### Pro

| Aspect | Detail |
|--------|--------|
| **Stored** | Not stored; no detective column. |
| **Derived** | From `detective.subscriptionPackage?.badges` (object: `badges['pro']`, or array: badge string `'pro'`). |
| **Backend** | No backend sync of “Pro” to detective; Pro is display-only from package badges. |
| **UI condition** | `detective.subscriptionPackageId && detective.subscriptionPackage?.badges` and then check for `pro` in that object/array. |
| **Data source for UI** | Only present when API returns detective with `subscriptionPackage` populated (e.g. `getDetective`). **Not** present in `searchServices` results (no join to `subscription_plans`), so Pro badge does **not** show in home/search service cards. |

### Recommended

| Aspect | Detail |
|--------|--------|
| **Stored** | Not stored; no detective column. |
| **Derived** | From `detective.subscriptionPackage?.badges` (object: `badges['recommended']`, or array: `'recommended'`). |
| **Backend** | No backend sync; display-only from package badges. |
| **UI condition** | Same as Pro but for `recommended` key/string. |
| **Data source for UI** | Same as Pro; only where `subscriptionPackage` is returned. **Not** shown in home/search service listing. |

---

## 4) Findings

### Correct or consistent implementations

- **Entitlement source:** Pro and Recommended are read from `subscription_plans.badges` (object or array) where the package is loaded; no separate stored flags.
- **Service profile page:** GET `/api/services/:id` uses `storage.getDetective()`, which joins `subscription_plans`, so `subscriptionPackage` and thus Pro/Recommended badges are available and can render correctly when the plan is active and not expired.
- **Detective profile page:** Uses same detective object (from service fetch) and same conditions for Blue Tick, Pro, Recommended, Verified.
- **applyPackageEntitlements:** Correctly derives `packageBadges` from active package (or empty when expired in-memory) and syncs **only** `hasBlueTick` / `blueTickActivatedAt` to the detective; when package does not include `blueTick`, it clears Blue Tick.
- **Ranking (ranking.ts):** Uses `subscriptionExpiresAt` for “Pro Badge” score (subscription active and not expired). Note: it does not use `subscription_plans.badges`; it uses legacy `subscriptionPlan` for “Blue Tick” score and `subscriptionPackageId + subscriptionExpiresAt` for a generic “Pro Badge” score.

### Incorrect or risky implementations

1. **Expiry does not clear Blue Tick**  
   `handleExpiredSubscriptions` and `checkDetectiveExpiry` in `subscriptionExpiry.ts` set `subscriptionPackageId` to FREE and clear expiry/pending fields but **never** call `applyPackageEntitlements`. So `hasBlueTick` is left true after expiry. UI still shows Blue Tick (because `hasBlueTick && subscriptionPackageId` and FREE plan id is truthy).

2. **Blue Tick shown without checking package entitlement**  
   UI requires `hasBlueTick && subscriptionPackageId` but does **not** require that the **current** package’s `badges.blueTick === true`. So after downgrade to FREE (or any plan without blueTick), if `hasBlueTick` was not cleared, the badge still shows.

3. **Pro and Recommended missing in search/home**  
   GET `/api/services` uses `storage.searchServices()`, which returns detectives from a query that does **not** join `subscription_plans`. So `detective.subscriptionPackage` is undefined. Frontend `mapServiceToCard` in home and search checks `subscriptionPackage?.badges` for Pro/Recommended; they are never added there, so these badges never appear on service cards in search or home, regardless of subscription.

4. **Snippet grid ignores subscription badges**  
   `DetectiveSnippetGrid` builds badges only from `item.isVerified ? ["verified"] : []`. It does **not** use `hasBlueTick`, `subscriptionPackage`, or `subscriptionPackageId`. So in snippets, only “verified” can appear; Blue Tick, Pro, and Recommended are never shown.

5. **No server-side “active subscription” check for badges**  
   APIs return detective and (when joined) subscription plan as stored. They do **not** recompute or strip badges based on `subscriptionExpiresAt`. So until the expiry job runs, an expired detective still has the old `subscriptionPackageId` and joined package with badges; UI would show Pro/Recommended until the job switches them to FREE.

6. **Blue Tick add-on vs package Blue Tick**  
   Blue Tick add-on payment sets `hasBlueTick = true` directly and does not call `applyPackageEntitlements`. If the user later gets a subscription that does **not** include `blueTick`, the next time `applyPackageEntitlements` runs (e.g. on another payment), it will set `hasBlueTick = false`, removing the add-on Blue Tick. So add-on Blue Tick is not consistently treated as independent of package badges.

---

## 5) Definitive answer

**Is badge logic implemented correctly?**  
**Partially.**

- **Pro / Recommended:** Correctly derived from package badges where the package is loaded; but they are **not** shown in search/home/snippet because those flows do not get `subscriptionPackage`, and snippet does not use subscription badges at all.
- **Blue Tick:** Stored and synced from package on activation, but **not** revoked on expiry or downgrade because the expiry job does not call `applyPackageEntitlements`. UI does not verify that the current package actually includes the Blue Tick badge.

---

## 6) Concrete problem list

- After subscription **expires**, Blue Tick can still show (expiry job does not call `applyPackageEntitlements` to clear `hasBlueTick`).
- After **downgrade** to a plan without Blue Tick, Blue Tick can still show (no code path runs `applyPackageEntitlements` on downgrade; stored `hasBlueTick` unchanged).
- **Pro** and **Recommended** never appear on service cards on **home** and **search** (detective from `searchServices` has no `subscriptionPackage`).
- **Snippet** service cards only show “verified”; **Blue Tick, Pro, Recommended** are not considered (hardcoded `badges: item.isVerified ? ["verified"] : []`).
- UI shows Blue Tick whenever `hasBlueTick && subscriptionPackageId`, without checking that the **current package** has `badges.blueTick === true`.
- Backend never strips or recalculates badge-related data using `subscriptionExpiresAt` before sending; badge display depends on stored state and which API (with or without package join) was used.

---

## 7) Files involved

### Backend

- `server/routes.ts` — `applyPackageEntitlements`, payment verify (Razorpay/PayPal), Blue Tick verify, maskDetectiveContactsPublic; GET `/api/services`, GET `/api/services/:id`.
- `server/storage.ts` — `getDetective`, `getDetectiveByUserId`, `searchServices`, `getSubscriptionPlanById`, `updateDetectiveAdmin` (allowed fields; comment about hasBlueTick/blueTickActivatedAt).
- `server/services/subscriptionExpiry.ts` — `handleExpiredSubscriptions`, `checkDetectiveExpiry` (downgrade to FREE; no call to `applyPackageEntitlements`).
- `server/ranking.ts` — visibility score and use of `subscriptionPlan`, `subscriptionPackageId`, `subscriptionExpiresAt` (no use of `subscription_plans.badges`).
- `shared/schema.ts` — `detectives.hasBlueTick`, `detectives.blue_tick_activated_at`, `detectives.is_verified`; `subscription_plans.badges`.

### Frontend

- `client/src/pages/home.tsx` — `mapServiceToCard`: Blue Tick (`hasBlueTick && subscriptionPackageId`), Pro/Recommended (`subscriptionPackage?.badges`), Verified (`isVerified`).
- `client/src/pages/search.tsx` — Same `mapServiceToCard` logic as home.
- `client/src/pages/detective.tsx` — Badge array built from `hasBlueTick`, `subscriptionPackage?.badges`, `isVerified`.
- `client/src/pages/detective-profile.tsx` — Blue Tick, Pro, Recommended, Verified conditions for profile view.
- `client/src/components/home/service-card.tsx` — Renders badges from `badges` prop (blueTick, pro, recommended, verified).
- `client/src/components/snippets/detective-snippet-grid.tsx` — `badges: item.isVerified ? ["verified"] : []` (no Blue Tick, Pro, or Recommended).

---

*End of audit. No code was modified; no fixes were implemented.*
