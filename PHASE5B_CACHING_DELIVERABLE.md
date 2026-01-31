# Phase 5B – Expand Caching (Cache-Aside) – Deliverable

**Date:** 2026-01-31  
**Scope:** Additional public read-heavy endpoints using the same cache-aside pattern as Phase 5A. Reused `server/lib/cache.ts`. No refactors, no API response changes, no auth/admin/payments/subscriptions/role-based caching.

---

## 1. Files changed

| File | Change |
|------|--------|
| **server/routes.ts** | (1) **GET /api/services:** Cache key changed from `services:home:` to `services:search:<stable-params>`. Skip cache when `req.session?.userId` is set (authenticated). Cache get/set wrapped in try/catch; debug logs `[cache HIT] <key>` / `[cache MISS] <key>`. (2) **GET /api/detectives/:id:** Added cache-aside with key `detective:public:<id>`, TTL 60s. Skip cache when request is authenticated as the detective (`req.session.userId === detective.userId`) or as admin (`req.session.userRole === 'admin'`). Cache get/set in try/catch; same debug log format. (3) **GET /api/snippets/:id:** Added cache-aside with key `snippets:<id>`, TTL 300s. Cache get before DB, set after; try/catch and debug logs. |
| **server/routes/public-pages.ts** | Debug log format aligned with Phase 5B: `[cache HIT] <cacheKey>` and `[cache MISS] <cacheKey>` (replacing `[cache] HIT/MISS cms:page`). No other behavior change. |

---

## 2. Endpoints cached

| Endpoint | Cached? | Skip cache when |
|----------|---------|------------------|
| GET /api/services | Yes | Request is authenticated (`req.session?.userId`) |
| GET /api/detectives/:id | Yes | Request is the detective owner or admin |
| GET /api/snippets/:id | Yes | Never (public-only route) |
| GET /api/categories | No | N/A – no public list endpoint exists (only GET /api/admin/categories, admin-only) |
| GET /api/tags | No | N/A – no public list endpoint exists (only GET /api/admin/tags, admin-only) |

---

## 3. Cache keys used

| Endpoint | Cache key | Example |
|----------|-----------|---------|
| GET /api/services | `services:search:<stable-sorted-query-params>` | `services:search:category=&country=&limit=20&maxPrice=&minPrice=&minRating=&offset=0&search=&sortBy=popular` |
| GET /api/detectives/:id | `detective:public:<id>` | `detective:public:5182df19-2da5-4cfd-b069-d11e9dea4297` |
| GET /api/snippets/:id | `snippets:<id>` | `snippets:abc-123` |

Stable query params for `/api/services` are the same sorted list as Phase 5A: `category`, `country`, `search`, `minPrice`, `maxPrice`, `minRating`, `limit`, `offset`, `sortBy`.

---

## 4. TTLs used

| Endpoint | TTL |
|----------|-----|
| GET /api/services | 60 seconds |
| GET /api/detectives/:id | 60 seconds |
| GET /api/snippets/:id | 300 seconds (5 minutes) |

---

## 5. Safety and observability

- All cache `get` and `set` calls are wrapped in try/catch. Cache failures do not break the request; handlers fall through to existing DB logic or skip storing.
- One `console.debug` per endpoint:
  - **HIT:** `[cache HIT] <key>`
  - **MISS:** `[cache MISS] <key>`

---

## 6. Category and tag listings (4)

- **GET /api/categories** and **GET /api/tags** were not cached.
- There are no public list endpoints for CMS categories or tags. The only list endpoints are **GET /api/admin/categories** and **GET /api/admin/tags** (admin-only), which are excluded from caching by the “do not cache admin” rule.
- Public CMS routes that exist are **GET /api/public/categories/:slug/pages** and **GET /api/public/tags/:slug/pages** (pages by category/tag slug), not full lists. No cache was added for those in this phase.

---

## 7. Behavior unchanged

- **GET /api/services:** Response shape, status codes, pagination, filters, and headers are unchanged. Cache is bypassed for authenticated requests; anonymous requests use cache-aside as before (with key prefix `services:search:`).
- **GET /api/detectives/:id:** Response shape `{ detective, claimInfo }` and 404/500 behavior unchanged. Cache is bypassed when the caller is the detective or admin.
- **GET /api/snippets/:id:** Response shape `{ snippet }` and 404/500 behavior unchanged. Cache-aside added; no ordering or limit changes (single snippet by id).

Phase 5B caching complete. No behavior changes introduced.
