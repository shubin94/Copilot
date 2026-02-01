# Phase 5C – Cache Invalidation Hooks – Deliverable

**Date:** 2026-01-31  
**Scope:** Explicit cache invalidation after successful writes that affect cached public data (Phase 5A/5B). Uses only `cache.del()` (and `cache.keys()` for prefix-based invalidation). No refactors, no API response changes, no background jobs, no new cache keys.

---

## 1. Files changed

| File | Change |
|------|--------|
| **server/lib/cache.ts** | Added `keys(): string[]` returning all cache keys so callers can prefix-invalidate by iterating and calling `del(key)`. |
| **server/routes/admin-cms.ts** | Import `../lib/cache.ts`. After successful **createPage**: invalidate `cms:page:<slug>` and `cms:page:<category.slug>:<slug>` (using saved page and existing `category`). After successful **updatePage**: same two keys from returned `page`. Before **deletePage**: fetch page with `getPageById`, then after successful delete invalidate same two keys from that page. All invalidation in try/catch; single `console.debug("[cache INVALIDATE]", ...)` per hook. |
| **server/routes.ts** | After successful **createService**: delete all keys with prefix `services:` via `cache.keys().filter(...).forEach(cache.del)`, then `cache.del(\`detective:public:${service.detectiveId}\`)`. After successful **updateService**: same (using `service.detectiveId`). After successful **deleteService**: same (using `service.detectiveId` before delete). After successful **POST /api/snippets**: `cache.del(\`snippets:${snippet[0].id}\`)`. After successful **PUT /api/snippets/:id**: `cache.del(\`snippets:${id}\`)`. After successful **DELETE /api/snippets/:id**: `cache.del(\`snippets:${id}\`)`. All invalidation in try/catch; one debug line per logical invalidation. |

---

## 2. Write actions hooked

| Action | Where | When invalidation runs |
|--------|--------|------------------------|
| Admin create CMS page | POST /api/admin/pages | After `createPage()` succeeds; uses `page.slug` and `category.slug` from request context. |
| Admin update CMS page | PATCH /api/admin/pages/:id | After `updatePage()` succeeds; uses returned `page.slug` and `page.category?.slug`. |
| Admin delete CMS page | DELETE /api/admin/pages/:id | After `deletePage()` succeeds; uses `getPageById(id)` result fetched before delete. |
| Detective create service | POST /api/services (requireRole detective) | After `storage.createService()` succeeds; uses `service.detectiveId`. |
| Detective update service | PATCH /api/services/:id | After `storage.updateService()` succeeds; uses `service.detectiveId`. |
| Detective delete service | DELETE /api/services/:id | After `storage.deleteService()` succeeds; uses `service.detectiveId` captured before delete. |
| Admin create snippet | POST /api/snippets | After insert succeeds; uses `snippet[0].id`. |
| Admin update snippet | PUT /api/snippets/:id | After update succeeds; uses `req.params.id`. |
| Admin delete snippet | DELETE /api/snippets/:id | After delete succeeds; uses `req.params.id`. |

---

## 3. Cache keys invalidated

| Write | Keys invalidated |
|-------|-------------------|
| CMS page create/update/delete | `cms:page:<slug>`, `cms:page:<category>:<slug>` |
| Service create/update/delete | All keys with prefix `services:` (covers `services:home:*` and `services:search:*`), plus `detective:public:<detectiveId>` |
| Snippet create/update/delete | `snippets:<id>` |

Prefix clearing for services is implemented by `cache.keys().filter(k => k.startsWith("services:")).forEach(k => cache.del(k))`. No new cache keys were added.

---

## 4. Safety

- Every invalidation block is inside try/catch. On cache error, the catch is silent (no throw); the HTTP response is unchanged.
- A single `console.debug("[cache INVALIDATE] <key or prefix>")` is used per logical invalidation (e.g. one for services prefix, one for detective key; one for each CMS page slug; one per snippet id).

---

## 5. Behavior unchanged

- Response shapes, status codes, and request/response semantics for all affected routes are unchanged.
- Invalidation runs only after successful DB writes; failed writes do not trigger invalidation.
- No background jobs or new cache keys were introduced.

Phase 5C cache invalidation complete. No behavior changes introduced.
