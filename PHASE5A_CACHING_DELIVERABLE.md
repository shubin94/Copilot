# Phase 5A – Caching (Cache-Aside / Lazy Loading) – Deliverable

**Date:** 2026-01-31  
**Scope:** Cache utility + two public read-only endpoints. No refactors, no API response changes, no auth/admin/payments/subscriptions/role-based caching.

---

## 1. Files changed

| File | Change |
|------|--------|
| **server/lib/cache.ts** | **NEW.** In-memory cache helper with `get(key)`, `set(key, value, ttlSeconds)`, `del(key)`. TTL via `expiresAt`; string keys; store holds JSON-serializable values. |
| **server/routes.ts** | Import `server/lib/cache.ts`. In `GET /api/services`: build cache key from stable query params → try cache get → on hit return cached JSON and exit; on miss run existing DB/ranking/masking logic → try cache set → then same `res.set` + `sendCachedJson` as before. All cache access wrapped in try/catch. |
| **server/routes/public-pages.ts** | Import `server/lib/cache.ts`, add `CMS_PAGE_TTL_SECONDS = 300`. In `GET /:category/:slug`: try cache get → on hit `res.json({ page: cached })` and return; on miss `fetchPage()` (published only) → try cache set → `res.json({ page })`. In `GET /:slug` (legacy): same pattern with slug-only key. All cache access in try/catch. |

---

## 2. Cache keys used

| Endpoint | Cache key pattern | Example |
|----------|--------------------|---------|
| GET /api/services | `services:home:<stable-query-params>` | `services:home:category=&country=&limit=20&maxPrice=&minPrice=&minRating=&offset=0&search=&sortBy=popular` |
| GET /api/public/pages/:category/:slug | `cms:page:<category>:<slug>` | `cms:page:blog:about-us` |
| GET /api/public/pages/:slug (legacy) | `cms:page:<slug>` | `cms:page:about-us` |

Stable query params for `/api/services` are built from sorted keys: `category`, `country`, `search`, `minPrice`, `maxPrice`, `minRating`, `limit`, `offset`, `sortBy`.

---

## 3. TTLs used

| Endpoint | TTL |
|----------|-----|
| GET /api/services | **60 seconds** |
| GET /api/public/pages/:category/:slug | **300 seconds (5 minutes)** |
| GET /api/public/pages/:slug (legacy) | **300 seconds (5 minutes)** |

---

## 4. Safety

- **Try/catch:** All cache `get` and `set` calls are inside try/catch. On cache error, the handler continues without cache (cache miss path or skip store); the request is never failed due to cache.
- **Logging:** One `console.debug` on cache HIT and one on cache MISS for each endpoint:
  - Services: `[cache] HIT services:home` / `[cache] MISS services:home`
  - CMS pages: `[cache] HIT cms:page` / `[cache] MISS cms:page`

---

## 5. Behavior unchanged

- **GET /api/services:** Response shape, status codes, pagination, filters, `Cache-Control` header, and `sendCachedJson` (ETag/304) are unchanged. Only an optional cache layer was added before/after existing logic.
- **GET /api/public/pages/:category/:slug** and **GET /api/public/pages/:slug:** Response shape `{ page }`, 400/404/500 behavior, and “published only” semantics (via existing `fetchPage` WHERE `status = 'published'`) are unchanged. Only an optional cache layer was added.

No refactors were applied; no auth, admin, payments, subscriptions, or role-based data are cached.

---

Phase 5A caching complete. No behavior changes introduced.
