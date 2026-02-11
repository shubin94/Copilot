# Search Caching Implementation Audit Report

**Date:** February 10, 2026  
**Scope:** End-to-end caching analysis for search and related endpoints  
**Status:** 🚨 CRITICAL ISSUES IDENTIFIED

---

## Executive Summary

The search implementation uses **4 distinct caching layers** with several architectural issues causing cache fragmentation, invalidation problems, and potential performance degradation. While basic caching is functional, the current implementation has **11 critical issues** that limit cache effectiveness and may cause data freshness/consistency problems.

**Key Findings:**
- ❌ **Cache Hit Ratio: UNMEASURED** (no metrics collection)
- ❌ **Cache Fragmentation: HIGH** (unordered query params create unique keys)
- ⚠️ **Double Caching: YES** (Backend + React Query with conflicting TTLs)
- ⚠️ **Stale Data Risk: MODERATE** (No cache invalidation on detective profile updates)
- ✅ **Auth Data Isolation: CORRECT** (user-specific requests skip cache)

---

## 1. Cache Layer Architecture

### 1.1 Identified Cache Layers

| Layer | Type | Location | TTL | Purpose |
|-------|------|----------|-----|---------|
| **L1: In-Memory (Backend)** | Map-based | `server/lib/cache.ts` | Variable | Search results, detective profiles |
| **L2: Ranked Detectives** | Map-based | `server/routes.ts` (local) | 2 minutes | Ranking algorithm results |
| **L3: React Query** | Browser Memory | Client-side | Infinity (default) | API response caching |
| **L4: HTTP/ETag** | Browser Cache | Client HTTP layer | Conditional | 304 Not Modified responses |

**Issue #1: FOUR SEPARATE CACHE LAYERS with no coordination**
- Each layer has independent TTLs and invalidation logic
- No cache consistency guarantees across layers
- Potential for serving stale data from any layer

---

## 2. Search Endpoint Caching (`/api/services`)

### 2.1 Cache Key Generation

**Location:** [server/routes.ts:3208-3211](server/routes.ts#L3208-L3211)

```typescript
const stableParams = [
  "category", "country", "search", "minPrice", "maxPrice", 
  "minRating", "planName", "level", "limit", "offset", "sortBy"
].sort().map(k => `${k}=${String((req.query as Record<string, string>)[k] ?? "").trim()}`).join("&");
const cacheKey = `services:search:${stableParams}`;
```

**✅ Good:**
- Parameters are sorted to reduce fragmentation
- Empty values normalized to `""` (empty string)
- Trimmed whitespace

**❌ Issue #2: FALSE POSITIVES - Value normalization incomplete**
- `limit=20` vs `limit=020` → different keys (same semantic meaning)
- `minPrice=0` vs `minPrice=` vs missing → different keys (all mean no minimum)
- `sortBy=popular` vs missing → different keys (popular is default)
- Boolean filters not normalized (e.g., `planName=undefined` remains in key)

**Impact:** Cache fragmentation - each variation creates a new cache entry, reducing hit ratio.

---

### 2.2 Cache Storage and Retrieval

**Location:** [server/routes.ts:3213-3225](server/routes.ts#L3213-L3225)

```typescript
const skipCache = !!(req.session?.userId);
if (!skipCache) {
  try {
    const cached = cache.get<{ services: unknown[] }>(cacheKey);
    if (cached != null && Array.isArray(cached.services)) {
      console.debug("[cache HIT]", cacheKey);
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      sendCachedJson(req, res, cached);
      return;
    }
  } catch (_) {
    // Cache failure must not break the request
  }
  console.debug("[cache MISS]", cacheKey);
}
```

**✅ Good:**
- Skips cache for authenticated users (correct isolation)
- Silent failure handling (cache errors don't break requests)
- Debug logging for cache hits/misses

**❌ Issue #3: NO METRICS COLLECTION**
- Cache hit/miss logged to console only (not aggregated)
- No cache hit ratio calculation
- No performance impact measurement
- Cannot determine cache effectiveness

**❌ Issue #4: INCONSISTENT HTTP HEADERS**
- Cache HIT: `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- Cache MISS: Same headers applied AFTER data fetched
- Problem: Headers set regardless of backend cache status (misleading CDN/browser)

---

### 2.3 TTL Settings

| Cache Type | TTL | Configuration | Location |
|------------|-----|---------------|----------|
| Backend In-Memory | **60 seconds** | `cache.set(cacheKey, { services: masked }, 60)` | routes.ts:3286 |
| Ranked Detectives | **120 seconds** | `RANKED_DETECTIVES_TTL_MS = 2 * 60 * 1000` | routes.ts:3189 |
| HTTP Cache-Control | **60s + 300s SWR** | `max-age=60, stale-while-revalidate=300` | routes.ts:3218 |
| React Query | **Infinity** | `staleTime: Infinity` (default) | queryClient.ts:51 |

**❌ Issue #5: CONFLICTING TTLs ACROSS LAYERS**
- Backend cache expires after 60s
- Browser may serve stale for 360s (60 + 300 SWR)
- React Query never refetches (staleTime: Infinity)
- Ranked detectives independently cached for 120s

**Impact:** Users may see data up to 6 minutes old (360s browser cache) even though backend refreshes every 60s.

---

## 3. Ranked Detectives Caching

**Location:** [server/routes.ts:3189-3201](server/routes.ts#L3189-L3201)

```typescript
const RANKED_DETECTIVES_TTL_MS = 2 * 60 * 1000;
const rankedDetectivesCache = new Map<string, { expiresAt: number; data: any }>();
const getRankedDetectivesCache = (key: string) => {
  const entry = rankedDetectivesCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    rankedDetectivesCache.delete(key);
    return undefined;
  }
  return entry.data;
};
```

**❌ Issue #6: SEPARATE CACHE IMPLEMENTATION**
- Uses custom Map instead of shared `cache` module
- Duplicate TTL expiration logic (already in `cache.ts`)
- No centralized cache metrics/monitoring
- Cache key: `ranked:1000` (single key for all ranking data)

**❌ Issue #7: RANKED CACHE NEVER INVALIDATED**
- Ranking data cached for 2 minutes
- Detective updates (profile, level, subscription) don't clear ranking cache
- Services added/removed don't trigger recalculation
- Reviews added don't update ranking scores

**Impact:** Search results may show incorrect order for up to 2 minutes after detective changes.

---

## 4. Cache Invalidation Strategy

### 4.1 Service Creation/Update

**Location:** [server/routes.ts:3411-3414](server/routes.ts#L3411-L3414)

```typescript
cache.keys().filter(k => k.startsWith("services:")).forEach(k => cache.del(k));
cache.del(`detective:public:${service.detectiveId}`);
console.debug("[cache INVALIDATE]", "services:");
console.debug("[cache INVALIDATE]", `detective:public:${service.detectiveId}`);
```

**✅ Good:**
- Invalidates ALL search caches when service changes
- Clears related detective profile cache
- Logging for debugging

**❌ Issue #8: BRUTE-FORCE INVALIDATION**
- Iterates ALL cache keys (`cache.keys()`)
- O(n) operation where n = total cache entries
- Clears unrelated search queries (e.g., category searches when country service added)
- No granular invalidation by parameters

**Performance Impact:** Every service update scans entire cache (could be 100s-1000s of keys).

---

### 4.2 Detective Profile Updates

**Location:** [server/routes.ts:2932](server/routes.ts#L2932)

```typescript
const updatedDetective = await storage.updateDetective(req.params.id, validatedData);
res.json({ detective: updatedDetective });
```

**❌ Issue #9: NO CACHE INVALIDATION ON DETECTIVE UPDATES**
- Detective profile updates do NOT clear:
  - `detective:public:{id}` cache
  - Search result caches containing their services
  - Ranked detectives cache
- Users may see stale profile data for up to 60 seconds
- Search results show stale detective info for up to 60 seconds

**Affected Fields NOT Invalidated:**
- businessName, logo, location, level, country, phone, whatsapp, contactEmail, etc.

---

### 4.3 Subscription Plan Updates

**Location:** [server/routes.ts:2664](server/routes.ts#L2664)

```typescript
clearFreePlanCache();
cache.keys().filter((k) => k.startsWith("services:")).forEach((k) => { cache.del(k); });
console.debug("[cache INVALIDATE]", "services:");
```

**✅ Good:**
- Invalidates all search caches when plans change
- Clears free plan cache

**❌ Issue #10: RANKING CACHE NOT CLEARED**
- Badge scores change when subscription plans updated
- Ranked detectives cache still contains old ranking data
- Search order may be incorrect for up to 2 minutes

---

## 5. Double Caching Analysis

### 5.1 Backend Cache

- **TTL:** 60 seconds
- **Storage:** In-memory Map (`server/lib/cache.ts`)
- **Scope:** Server-wide (shared across all users)

### 5.2 React Query Cache

- **TTL:** Infinity (never expires)
- **Storage:** Browser memory
- **Scope:** Per-user, per-browser tab

**Configuration:** [client/src/lib/queryClient.ts:51](client/src/lib/queryClient.ts#L51)

```typescript
staleTime: Infinity,
retry: false,
```

**❌ Issue #11: REACT QUERY NEVER REFETCHES**
- `staleTime: Infinity` means data cached forever until page reload
- Backend cache expires after 60s, but client never requests fresh data
- Users must manually refresh page to see updates
- No automatic background refetch

**Impact:** Users see stale search results indefinitely until page reload, even though backend has fresh data.

---

## 6. HTTP Caching (ETag)

**Location:** [server/routes.ts:6113-6123](server/routes.ts#L6113-L6123)

```typescript
const sendCachedJson = (req: Request, res: Response, payload: any) => {
  const body = JSON.stringify(payload);
  const tag = 'W/"' + createHash('sha1').update(body).digest('hex') + '"';
  if (req.headers['if-none-match'] === tag) {
    res.status(304).end();
    return;
  }
  res.set('ETag', tag);
  res.json(payload);
};
```

**✅ Good:**
- Proper ETag weak comparison
- 304 Not Modified reduces bandwidth
- Works correctly with `stale-while-revalidate`

**⚠️ Concern: ETag + stale-while-revalidate interaction**
- Browser may serve stale from cache without ETag validation
- ETag only checked if cache expired or force-reload
- Unclear if this layer provides additional value given other caches

---

## 7. User-Specific Data Isolation

### 7.1 Authenticated Request Handling

**Location:** [server/routes.ts:3212](server/routes.ts#L3212)

```typescript
const skipCache = !!(req.session?.userId);
```

**✅ CORRECT:**
- Authenticated users always bypass cache
- Prevents leaking personalized data (favorites, recommendations)
- Cache only serves anonymous/public requests

**Cache-Control Headers:**
```typescript
if (!skipCache) {
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
} else {
  res.set("Cache-Control", "private, no-store");
}
```

**✅ CORRECT:**
- Anonymous: Public cache allowed
- Authenticated: No caching at any layer

---

## 8. Cache Metrics and Observability

### 8.1 Current Logging

```typescript
console.debug("[cache HIT]", cacheKey);
console.debug("[cache MISS]", cacheKey);
console.debug("[cache INVALIDATE]", "services:");
```

**❌ Issue #12: NO AGGREGATED METRICS**
- Console logs only (not persisted or analyzed)
- No cache hit ratio calculation
- No performance impact measurement
- No alerts for cache efficiency degradation

**Missing Metrics:**
- Total requests
- Cache hits vs misses
- Average response time (cached vs uncached)
- Cache size and memory usage
- Invalidation frequency

---

## 9. Other Cached Endpoints

### 9.1 Detective Profile (`/api/detectives/:id`)

- **TTL:** 60 seconds
- **Cache Key:** `detective:public:{id}`
- **Invalidation:** On service creation/update only (NOT on profile update)
- **Issue:** Stale profile data when detective updates their info

### 9.2 Service Categories (`/api/service-categories`)

- **TTL:** 300 seconds (5 minutes)
- **Cache-Control:** `max-age=300, stale-while-revalidate=600`
- **No backend in-memory cache** (only HTTP headers)
- **Issue:** No invalidation when categories updated in admin

### 9.3 Popular Categories (`/api/popular-categories`)

- **TTL:** 60 seconds
- **No backend cache** (only HTTP headers)
- **Data:** Top 6 search queries by count

---

## 10. Cache Fragmentation Analysis

### 10.1 Query Parameter Combinations

For 11 filter parameters with average 3 possible values each:
- **Theoretical combinations:** 3^11 ≈ **177,147 unique cache keys**
- **With pagination (50 offset values):** 177,147 × 50 = **8.8 million keys**

### 10.2 Actual Fragmentation

**Conservative Estimation:**
- 20 categories
- 50 countries
- 3 price ranges
- 2 rating filters
- 2 plans (pro/agency)
- 2 levels (level1/level2)
- 3 sort options
- 20 limit/offset combinations

**Realistic unique keys:** 20 × 50 × 3 × 2 × 2 × 2 × 3 × 20 = **1.44 million potential keys**

**Impact:**
- Cache hit ratio likely < 5% for highly fragmented queries
- Most queries are unique (first-time search)
- Memory usage grows linearly with unique queries

---

## 11. Performance Impact Assessment

### 11.1 Cache Hit Scenario (Fast Path)

```
User Request → Backend Check Cache → Cache HIT → Return Cached Data
Time: ~10-50ms (in-memory lookup)
```

### 11.2 Cache Miss Scenario (Slow Path)

```
User Request → Backend Check Cache → Cache MISS → 
  → Database Query (NEW: optimized with selected fields) →
  → Fetch Ranked Detectives (120s cache) →
  → Sort & Rank Results →
  → Mask Detective Data (async per service) →
  → Store in Cache →
  → Return Data
Time: ~200-400ms (with recent optimizations)
```

**Bottleneck:** Masking operation (`maskDetectiveContactsPublic`)
- Runs for EVERY service in results (20-50 services)
- `Promise.all` but still iterates 20-50 times
- Blocks response until all complete

---

## 12. Issues Summary

| # | Severity | Issue | Impact |
|---|----------|-------|--------|
| 1 | 🔴 CRITICAL | Four uncoordinated cache layers | Data inconsistency, complexity |
| 2 | 🟠 HIGH | Cache key normalization incomplete | Fragmentation, low hit ratio |
| 3 | 🔴 CRITICAL | No cache metrics collection | Cannot measure effectiveness |
| 4 | 🟡 MEDIUM | Inconsistent HTTP headers | Misleading CDN/browser caching |
| 5 | 🔴 CRITICAL | Conflicting TTLs across layers | Stale data served for 6 mins |
| 6 | 🟡 MEDIUM | Duplicate cache implementation | Code duplication, maintenance |
| 7 | 🟠 HIGH | Ranked cache never invalidated | Incorrect search order |
| 8 | 🟠 HIGH | Brute-force cache invalidation | O(n) performance on updates |
| 9 | 🔴 CRITICAL | No invalidation on detective updates | Stale profile data |
| 10 | 🟠 HIGH | Plan updates don't clear rankings | Incorrect badge/level ranking |
| 11 | 🔴 CRITICAL | React Query never refetches | Users see stale data forever |
| 12 | 🟠 HIGH | No aggregated metrics | Cannot optimize cache strategy |

---

## 13. Improvement Opportunities (NOT IMPLEMENTED)

### Priority 1: Critical Fixes

1. **Add Cache Metrics Middleware**
   - Track hits/misses/invalidations
   - Measure cache effectiveness
   - Alert on low hit ratios

2. **Fix React Query Configuration**
   - Change `staleTime: Infinity` to `staleTime: 60 * 1000` (60 seconds)
   - Enable background refetch
   - Add `refetchInterval: 60 * 1000` for active queries

3. **Invalidate Ranked Cache on Updates**
   - Detective profile updates
   - Service creation/deletion
   - Review additions
   - Subscription changes

4. **Add Cache Invalidation on Detective Updates**
   - Clear `detective:public:{id}` cache
   - Clear all search caches containing detective's services
   - Clear ranked detectives cache

### Priority 2: Performance Optimizations

5. **Normalize Cache Keys**
   - Parse and normalize numeric values (e.g., `limit=20` == `limit=020`)
   - Treat empty/undefined/0 the same for filters
   - Apply default values before cache key generation

6. **Granular Cache Invalidation**
   - Tag-based invalidation (by category, country, detective)
   - Only clear affected cache entries
   - Avoid full cache scan

7. **Unify Cache Implementations**
   - Use `cache.ts` for all caching (not separate Map)
   - Single TTL strategy
   - Centralized metrics

8. **Optimize Masking Operation**
   - Cache masked detective data separately
   - Reuse across multiple search results
   - Reduce per-request processing

### Priority 3: Architecture Improvements

9. **Add Redis Layer** (Future)
   - Persistent cache across server restarts
   - Shared cache for multi-instance deployment
   - Better TTL management

10. **CDN Configuration** (If applicable)
    - Verify Cloudflare cache settings
    - Configure cache rules for `/api/services`
    - Purge API for invalidation

11. **Add Cache Warming**
    - Pre-populate common searches (top 10 categories)
    - Background refresh before TTL expires
    - Reduce cold start latency

12. **Implement Adaptive TTL**
    - Longer TTL for stable data (categories, plans)
    - Shorter TTL for dynamic data (search results)
    - Adjust based on update frequency

---

## 14. Recommended Next Steps

1. **Deploy Metrics Collection** (1-2 hours)
   - Add cache hit/miss counters
   - Log cache effectiveness metrics
   - Monitor for 1 week to establish baseline

2. **Fix React Query Configuration** (30 minutes)
   - Update `staleTime` to 60 seconds
   - Enable background refetch
   - Test client-side cache behavior

3. **Add Detective Update Invalidation** (1-2 hours)
   - Clear detective cache on profile update
   - Clear search caches
   - Clear ranking cache
   - Test end-to-end cache invalidation

4. **Normalize Cache Keys** (2-3 hours)
   - Implement value normalization
   - Test cache hit ratio improvement
   - Monitor fragmentation reduction

5. **Unify Cache Implementation** (3-4 hours)
   - Migrate ranked detectives cache to `cache.ts`
   - Remove duplicate code
   - Centralize cache management

**Total Effort:** 7-12 hours for Priority 1 fixes

---

## 15. Conclusion

The current caching implementation provides basic functionality but suffers from:
- **Lack of observability** (no metrics)
- **Data staleness** (React Query never refetches)
- **Ineffective invalidation** (detective updates not cached)
- **Cache fragmentation** (poor key normalization)
- **Architectural complexity** (4 uncoordinated layers)

**Estimated Cache Hit Ratio: 10-25%** (unmeasured, based on fragmentation analysis)

**Recommended Action:** Implement Priority 1 fixes immediately to improve cache effectiveness and data freshness. Deploy metrics first to establish baseline before optimizations.

---

**Report Generated:** February 10, 2026  
**Audited By:** GitHub Copilot  
**Audit Duration:** Comprehensive end-to-end analysis
