# Services Search Route Analysis
## GET /api/services Endpoint Deep Dive

**Date:** February 19, 2026  
**Status:** ✅ ANALYZED  
**Endpoint:** `GET /api/services`  
**Files:** server/routes.ts, server/storage.ts  
**Analysis Depth:** Complete code inspection

---

## Route Handler Overview

**File:** `server/routes.ts`  
**Lines:** 4078-4165  
**Method:** GET  
**Path:** `/api/services`  
**Query Parameters:** category, country, search, minPrice, maxPrice, minRating, planName, level, limit, offset, sortBy

---

## Route Handler Code

```typescript
app.get("/api/services", async (req: Request, res: Response) => {
  try {
    const { category, country, search, minPrice, maxPrice, minRating, planName, level, limit = "20", offset = "0", sortBy = "popular" } = req.query;
    const stableParams = [
      "category", "country", "search", "minPrice", "maxPrice", "minRating", "planName", "level", "limit", "offset", "sortBy"
    ].sort().map(k => `${k}=${String((req.query as Record<string, string>)[k] ?? "").trim()}`).join("&");
    const cacheKey = `services:search:${stableParams}`;
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

    if (typeof search === 'string' && search.trim()) {
      await storage.recordSearch(search as string);
    }

    // Parse pagination parameters
    const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Cap at 100 to prevent abuse
    const offsetNum = parseInt(offset as string) || 0;

    // ⚠️ Get paginated services
    const allServices = await storage.searchServices({
      category: category as string,
      country: country as string,
      searchQuery: search as string,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      ratingMin: minRating ? parseFloat(minRating as string) : undefined,
      planName: planName as string,
      level: level as string,
    }, limitNum, offsetNum, sortBy as string);

    // ❌ PROBLEM 1: Filter out services without images (post-pagination)
    const servicesWithImages = allServices.filter((s: any) => {
      const hasImages = Array.isArray(s.images) && s.images.length > 0;
      return hasImages;
    });

    // ❌ PROBLEM 2: Load 1000 ranked detectives for re-sorting (heavyweight)
    const rankedLimit = 1000;
    const rankedCacheKey = `ranked:${rankedLimit}`;
    let rankedDetectives = getRankedDetectivesCache(rankedCacheKey);
    if (!rankedDetectives) {
      const { getRankedDetectives } = await import("./ranking");
      rankedDetectives = await getRankedDetectives({ limit: rankedLimit });
      setRankedDetectivesCache(rankedCacheKey, rankedDetectives);
    }
    const detectiveRankMap = new Map(rankedDetectives.map((d: any, idx: number) => [d.id, { score: d.visibilityScore, rank: idx }]));

    // ❌ PROBLEM 3: Re-sort results AFTER database sort (negates DB ordering)
    const sortedResults = servicesWithImages.sort((a: any, b: any) => {
      const aRank = detectiveRankMap.get(a.detectiveId);
      const bRank = detectiveRankMap.get(b.detectiveId);
      // Higher score = better ranking = appears first
      if (aRank && bRank) {
        return bRank.score - aRank.score;
      }
      // Services without ranking appear after ranked ones
      if (aRank) return -1;
      if (bRank) return 1;
      return 0;
    });

    const masked = await Promise.all(sortedResults.map(async (s: any) => {
      const maskedDetective = await maskDetectiveContactsPublic(s.detective);
      const effectiveBadges = computeEffectiveBadges(s.detective, (s.detective as any).subscriptionPackage);
      return { ...s, detective: { ...maskedDetective, effectiveBadges } };
    }));
    if (!skipCache) {
      try {
        cache.set(cacheKey, { services: masked }, 60);
      } catch (_) {
        // Cache failure must not break the request
      }
    }
    if (!skipCache) {
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    } else {
      // Authenticated/user-specific responses should not be cached
      res.set("Cache-Control", "private, no-store");
    }
    sendCachedJson(req, res, { services: masked });
  } catch (error) {
    console.error("Search services error:", error);
    res.status(500).json({ error: "Failed to search services" });
  }
});
```

---

## Storage Layer Function

**File:** `server/storage.ts`  
**Function:** `searchServices()`  
**Lines:** 859-1030

### Function Signature

```typescript
async searchServices(filters: {
  category?: string;
  country?: string;
  state?: string;
  city?: string;
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  ratingMin?: number;
  planName?: string;
  level?: string;
}, limit: number = 50, offset: number = 0, sortBy: string = 'recent'): Promise<Array<Service & { detective: Detective, avgRating: number, reviewCount: number, planName?: string }>>
```

### Filter Conditions Building

```typescript
const conditions = [ eq(services.isActive, true) ];

// ✅ STRICT CATEGORY MATCHING
if (filters.category) {
  conditions.push(eq(services.category, filters.category.trim()));
}

// Full-text search
if (filters.searchQuery) {
  const searchCondition = or(
    ilike(services.title, `%${filters.searchQuery}%`),
    ilike(services.description, `%${filters.searchQuery}%`),
    ilike(services.category, `%${filters.searchQuery}%`)
  );
  if (searchCondition) {
    conditions.push(searchCondition);
  }
}

// ✅ Country, State, City filters (in WHERE)
if (filters.country) {
  conditions.push(eq(detectives.country, filters.country));
}
if (filters.state) {
  conditions.push(ilike(detectives.state, filters.state));
}
if (filters.city) {
  conditions.push(ilike(detectives.city, filters.city));
}

// ✅ Plan name filter
if (filters.planName) {
  conditions.push(eq(subscriptionPlans.name, filters.planName));
}

// ✅ Level filter
if (filters.level) {
  conditions.push(eq(detectives.level, filters.level as any));
}

// ❌ MISSING: minPrice and maxPrice filters NOT applied!
// Accepted in function parameters but never used in WHERE conditions
```

### Reviews Subquery (Prevents Cartesian Product)

```typescript
const reviewsAgg = db.select({
  serviceId: reviews.serviceId,
  avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`.as('avg_rating'),
  reviewCount: count(reviews.id).as('review_count'),
})
.from(reviews)
.where(eq(reviews.isPublished, true))
.groupBy(reviews.serviceId)
.as('reviews_agg');
```

### SELECT Query - Specific Fields (NOT SELECT *)

```typescript
let query = db.select({
  // Service fields needed by ServiceCard
  serviceId: services.id,
  serviceTitle: services.title,
  serviceCategory: services.category,
  serviceBasePrice: services.basePrice,
  serviceOfferPrice: services.offerPrice,
  serviceIsOnEnquiry: services.isOnEnquiry,
  serviceMainImage: sql<string | null>`(${services.images})[1]`,
  serviceOrderCount: services.orderCount,
  
  // Detective fields needed by ServiceCard
  detectiveId: detectives.id,
  detectiveBusinessName: detectives.businessName,
  detectiveLevel: detectives.level,
  detectiveLogo: detectives.logo,
  detectiveCountry: detectives.country,
  detectiveState: detectives.state,
  detectiveCity: detectives.city,
  detectiveSlug: detectives.slug,
  detectivePhone: detectives.phone,
  detectiveWhatsapp: detectives.whatsapp,
  detectiveContactEmail: detectives.contactEmail,
  detectiveIsVerified: detectives.isVerified,
  
  // Aggregated values
  avgRating: reviewsAgg.avgRating,
  reviewCount: reviewsAgg.reviewCount,
})
```

### JOIN Clause - 4 LEFT JOINs

```typescript
.from(services)
.leftJoin(detectives, eq(services.detectiveId, detectives.id))  // LEFT JOIN - include all services
.leftJoin(users, eq(detectives.userId, users.id))
.leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
.leftJoin(reviewsAgg, eq(services.id, reviewsAgg.serviceId))  // Join aggregated reviews, not raw reviews
.where(and(...conditions));
```

### HAVING Clause & Sorting

```typescript
// Rating filter uses WHERE on aggregated values
if (filters.ratingMin !== undefined) {
  query = query.having(sql`COALESCE(${reviewsAgg.avgRating}, 0) >= ${filters.ratingMin}`) as any;
}

// Sort
if (sortBy === 'popular') {
  query = query.orderBy(desc(services.orderCount), sql`RANDOM()`) as any;
} else if (sortBy === 'rating') {
  query = query.orderBy(desc(reviewsAgg.avgRating)) as any;
} else if (sortBy === 'price_low') {
  query = query.orderBy(services.basePrice) as any;
} else if (sortBy === 'price_high') {
  query = query.orderBy(desc(services.basePrice)) as any;
} else {
  query = query.orderBy(desc(services.createdAt)) as any;
}
```

### ⚠️ LIMIT/OFFSET - With Critical Override

```typescript
// ⚠️ PROBLEM: Popular sort overrides user's limit parameter!
const cappedLimit = sortBy === "popular" ? 15 : limit;
const results = await query.limit(cappedLimit).offset(offset);

console.log('[searchServices] FINAL services count:', results.length, 'sortBy:', sortBy);
```

### Result Mapping with Loop

```typescript
const mapped: Array<Service & { detective: Detective; avgRating: number; reviewCount: number; planName?: string }> = [];
for (const r of results as any[]) {
  let detectiveSlug = r.detectiveSlug as string | null | undefined;
  if (!detectiveSlug && r.detectiveBusinessName) {
    const newSlug = generateSlug(r.detectiveBusinessName);
    console.log(`[AUTO-REPAIR] Detective ${r.detectiveId} missing slug in searchServices, generating: ${newSlug}`);
    try {
      await db.update(detectives)
        .set({ slug: newSlug })
        .where(eq(detectives.id, r.detectiveId));
      detectiveSlug = newSlug;
    } catch (error) {
      console.error(`[AUTO-REPAIR] Failed to save slug for detective ${r.detectiveId}:`, error);
    }
  }

  mapped.push({
    id: r.serviceId,
    title: r.serviceTitle,
    category: r.serviceCategory,
    basePrice: r.serviceBasePrice,
    offerPrice: r.serviceOfferPrice,
    isOnEnquiry: r.serviceIsOnEnquiry,
    images: r.serviceMainImage ? [r.serviceMainImage] : [],
    orderCount: r.serviceOrderCount,
    detective: {
      id: r.detectiveId,
      businessName: r.detectiveBusinessName,
      level: r.detectiveLevel,
      logo: r.detectiveLogo,
      country: r.detectiveCountry,
      state: r.detectiveState,
      city: r.detectiveCity,
      slug: detectiveSlug,
      phone: r.detectivePhone,
      whatsapp: r.detectiveWhatsapp,
      contactEmail: r.detectiveContactEmail,
      isVerified: r.detectiveIsVerified,
    },
    avgRating: Number(r.avgRating),
    reviewCount: Number(r.reviewCount),
  } as any);
}

return mapped;
```

---

## Generated SQL Query

### Complete Query Structure

```sql
SELECT 
  services.id as serviceId,
  services.title as serviceTitle,
  services.category as serviceCategory,
  services.base_price as serviceBasePrice,
  services.offer_price as serviceOfferPrice,
  services.is_on_enquiry as serviceIsOnEnquiry,
  (services.images)[1] as serviceMainImage,
  services.order_count as serviceOrderCount,
  detectives.id as detectiveId,
  detectives.business_name as detectiveBusinessName,
  detectives.level as detectiveLevel,
  detectives.logo as detectiveLogo,
  detectives.country as detectiveCountry,
  detectives.state as detectiveState,
  detectives.city as detectiveCity,
  detectives.slug as detectiveSlug,
  detectives.phone as detectivePhone,
  detectives.whatsapp as detectiveWhatsapp,
  detectives.contact_email as detectiveContactEmail,
  detectives.is_verified as detectiveIsVerified,
  reviews_agg.avg_rating as avgRating,
  reviews_agg.review_count as reviewCount
FROM services
LEFT JOIN detectives ON services.detective_id = detectives.id
LEFT JOIN users ON detectives.user_id = users.id
LEFT JOIN subscription_plans ON detectives.subscription_package_id = subscription_plans.id
LEFT JOIN (
  SELECT 
    service_id as serviceId,
    COALESCE(AVG(rating), 0) as avg_rating,
    COUNT(id) as review_count
  FROM reviews
  WHERE is_published = true
  GROUP BY service_id
) as reviews_agg ON services.id = reviews_agg.serviceId
WHERE 
  services.is_active = true
  AND services.category = 'category_name'
  AND detectives.country = 'IN'
  AND (services.title ILIKE '%search%' OR services.description ILIKE '%search%')
ORDER BY 
  services.order_count DESC,
  RANDOM()
LIMIT 15 
OFFSET 0;
```

---

## Analysis: Confirmation of Claims

### ✅ Q1: Is LIMIT and OFFSET applied in SQL?

**Answer:** YES

**Line:** `query.limit(cappedLimit).offset(offset)` at line 993 in storage.ts

```typescript
const cappedLimit = sortBy === "popular" ? 15 : limit;
const results = await query.limit(cappedLimit).offset(offset);
```

**SQL Generated:**
```sql
LIMIT 15 
OFFSET 0
```

**Status:** ✅ Correctly applied in SQL layer

---

### ✅ Q2: Is there any .slice() in JavaScript?

**Answer:** NO

**Verification:**
- No `.slice()` call found in routes.ts after `searchServices()` call
- Results are used directly: `allServices.filter()` then `sort()` then `map()`
- No pagination manipulation in JavaScript

**Status:** ✅ No JavaScript slicing (good practice maintained)

---

### ✅ Q3: Are we selecting * (all columns) or only required fields?

**Answer:** SPECIFIC FIELDS (NOT SELECT *)

**Column Count:** 21 specific fields selected

**Service Fields (8):**
- id (serviceId)
- title (serviceTitle)
- category (serviceCategory)  
- basePrice (serviceBasePrice)
- offerPrice (serviceOfferPrice)
- isOnEnquiry (serviceIsOnEnquiry)
- images[1] extracted (serviceMainImage)
- orderCount (serviceOrderCount)

**Detective Fields (11):**
- id (detectiveId)
- businessName (detectiveBusinessName)
- level (detectiveLevel)
- logo (detectiveLogo)
- country (detectiveCountry)
- state (detectiveState)
- city (detectiveCity)
- slug (detectiveSlug)
- phone (detectivePhone)
- whatsapp (detectiveWhatsapp)
- contactEmail (detectiveContactEmail)
- isVerified (detectiveIsVerified)

**Aggregated Fields (2):**
- avgRating (from reviewsAgg subquery)
- reviewCount (from reviewsAgg subquery)

**Status:** ✅ Optimized: SELECT specific fields only, NOT SELECT *

---

### ✅ Q4: Are joins optimized?

**Answer:** PARTIALLY OPTIMIZED

**Join Structure:**
```
services (main table)
  ↓ LEFT JOIN detectives (1-to-1)
  ↓ LEFT JOIN users (1-to-1)
  ↓ LEFT JOIN subscription_plans (1-to-1)
  ↓ LEFT JOIN reviewsAgg subquery (1-to-many aggregated)
```

**Optimization Details:**

✅ **Reviews Aggregation Subquery Used**
- Instead of: `LEFT JOIN reviews` on services.id = reviews.serviceId (would multiply rows)
- Correctly: Uses subquery with `GROUP BY` to aggregate reviews per service
- Result: No cartesian product, clean 1-to-1 relationship

❌ **Users Join Unused**
- Line 979: `.leftJoin(users, eq(detectives.userId, users.id))`
- Problem: Users table joined but NO user fields selected
- Impact: Unnecessary LEFT JOIN adds cost
- Fix: Remove this join entirely

❌ **SubscriptionPlans Join Partially Used**
- Line 980: `.leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))`
- Selected: No subscriptionPlans fields selected in the query
- Problem: In routes.ts `computeEffectiveBadges()` may need it, but not from this query
- Impact: Small cost, but loaded here and might be duplicated

**Status:** ⚠️ PARTIALLY OPTIMIZED - 3 of 4 joins are justified

---

### ❌ Q5: Is there any N+1 pattern?

**Answer:** Mostly NO, but one edge case EXISTS

**Main Query:** ✅ Batch operation
- Single query returns all services with detective info
- No N+1 for main result set

**Slug Generation Loop:** ⚠️ Potential N+1
```typescript
for (const r of results as any[]) {
  if (!detectiveSlug && r.detectiveBusinessName) {
    // ... UPDATE query inside loop ...
    await db.update(detectives)
      .set({ slug: newSlug })
      .where(eq(detectives.id, r.detectiveId));
  }
}
```

**Problem:**
- If ANY result has missing slug, UPDATE executed inside loop
- Each missing slug = 1 UPDATE query
- Worst case: N queries for N results with missing slugs
- Probability: Low (slugs should exist), but not zero

**Severity:** LOW (rare case, slow only if slugs missing for many records)

**Status:** ⚠️ POTENTIAL N+1 in edge case (slug generation)

---

## Issues Summary

| # | Issue | Location | Type | Severity | Impact |
|---|-------|----------|------|----------|--------|
| **1** | Price filters (`minPrice`, `maxPrice`) ignored | storage.ts:859-920 | BUG | HIGH | Filters accepted but never applied to WHERE |
| **2** | Popular sort overrides limit (15 hardcoded) | storage.ts:993 | BUG | CRITICAL | `sortBy === "popular" ? 15 : limit` forces max 15 |
| **3** | Post-pagination image filtering | routes.ts:4123-4126 | ARCHITECTURE | HIGH | `.filter()` after pagination reduces result count |
| **4** | Redundant re-sorting | routes.ts:4135-4156 | ARCHITECTURE | MEDIUM | Fetches 1000 ranked detectives, re-sorts paginated results |
| **5** | Unused users JOIN | storage.ts:979 | OPTIMIZATION | LOW | JOIN added but no user fields selected |
| **6** | Partial subscriptionPlans usage | storage.ts:980 | OPTIMIZATION | LOW | JOIN added but plan fields not selected here |
| **7** | Potential N+1 in slug generation | storage.ts:1001-1008 | EDGE CASE | LOW | UPDATE per missing slug inside loop |

---

## Query Performance Characteristics

### Column Selection: ✅ OPTIMIZED
- **21 specific fields** selected (not SELECT *)
- **Only fields needed by UI** included
- **Array extraction**: `(services.images)[1]` gets first image only
- **Data transfer reduced**

### JOINs: ⚠️ PARTIALLY OPTIMIZED
- **4 LEFT JOINs** total
- **Reviews aggregated** via subquery (good)
- **Users join unused** (bad - should remove)
- **SubscriptionPlans partially used** (minor issue)

### Filtering: ⚠️ INCOMPLETE
- **7 conditions applied** in WHERE: isActive, category, search, country, state, city, plan, level
- **2 filters missing**: minPrice and maxPrice accepted but not applied
- **1 filter uses HAVING**: ratingMin on aggregated avgRating (correct)

### Sorting: ❌ PROBLEMATIC
- **5 sort options** available: popular, rating, price_low, price_high, recent
- **Popular sort breaks limit**: Always returns 15 (or fewer), regardless of request
- **Other sorts respect limit**: Only popular sort has override

### Pagination: ✅ CORRECT
- **LIMIT in SQL**: Applied before returning
- **OFFSET in SQL**: Applied with LIMIT
- **No JavaScript slicing**: Results used as-is
- **Accurate page fetching** (except when popular sort forces limit=15)

---

## Data Flow

```
Request: GET /api/services?category=investigation&country=IN&limit=20&offset=0&sortBy=popular

┌─────────────────────────────────────────┐
│ 1. Route Handler (routes.ts:4078)       │
│   - Parse query parameters              │
│   - Check cache                         │
│   - limitNum = min(20, 100) = 20        │
│   - offsetNum = 0                       │
│   - sortBy = "popular"                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. Storage Layer (storage.ts:859)       │
│   - Building conditions array           │
│   - Select 21 specific fields           │
│   - Build 4 LEFT JOINs                  │
│   - Apply WHERE conditions              │
│   - Create reviews subquery             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. Sorting Decision                     │
│   - sortBy = "popular"?                 │
│   - ORDER BY orderCount DESC, RANDOM()  │
│   - ⚠️ cappedLimit = 15 (override!)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 4. SQL Execution                        │
│   SELECT 21 fields                      │
│   FROM services                         │
│   LEFT JOIN detectives (...)            │
│   LEFT JOIN users (...)                 │
│   LEFT JOIN subscriptionPlans (...)     │
│   LEFT JOIN reviewsAgg (...)            │
│   WHERE (category='investigation'       │
│      AND country='IN'                   │
│      AND isActive=true)                 │
│   ORDER BY orderCount DESC, RANDOM()    │
│   LIMIT 15                              │ ⚠️ Not 20!
│   OFFSET 0                              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 5. Result Processing (routes.ts:4123)   │
│   - Returns: 15 records (not 20!)       │
│   - ❌ .filter() removes some           │
│   - ❌ Fetch 1000 ranked detectives     │
│   - ❌ Re-sort by detective rank        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 6. Masking & Response                   │
│   - Mask detective contacts             │
│   - Add effectiveBadges                 │
│   - Cache result (60s)                  │
│   - Send JSON response                  │
└─────────────────────────────────────────┘
```

---

## Critical Issues Detail

### Issue #1: Price Filters Ignored

**What happens:**
```typescript
// User requests: ?minPrice=1000&maxPrice=5000
const allServices = await storage.searchServices({
  // ...
  minPrice: minPrice ? parseFloat(minPrice as string) : 1000,
  maxPrice: maxPrice ? parseFloat(maxPrice as string) : 5000,
  // ...
});
```

**In storage layer:**
```typescript
// ❌ These are never used!
// if (filters.minPrice !== undefined) {
//   conditions.push(sql`${services.basePrice} >= ${filters.minPrice}`);
// }
// if (filters.maxPrice !== undefined) {
//   conditions.push(sql`${services.basePrice} <= ${filters.maxPrice}`);
// }
```

**Result:** Users can set price range but it's ignored, all services returned regardless

---

### Issue #2: Popular Sort Hardcoded to 15

**What happens:**
```typescript
// User requests: ?sortBy=popular&limit=50
// Expected: 50 popular services
// Actual: 15 popular services

const cappedLimit = sortBy === "popular" ? 15 : limit;
const results = await query.limit(cappedLimit).offset(offset);
// cappedLimit = 15, so only 15 queries regardless of limit=50
```

**Side Effects:**
- `offset` still works but meaningless if limit=15
- Page 1: 15 records
- Page 2 request: `offset=15` fetches next 15
- But UI asked for `limit=50, offset=0` expecting 50

**Result:** Performance hack breaks pagination UX for "popular" sort

---

### Issue #3: Post-Pagination Image Filtering

**What happens:**
```typescript
// From storage: returns 15 services
const allServices = [...15 services...];

// In routes.ts:
const servicesWithImages = allServices.filter((s: any) => {
  const hasImages = Array.isArray(s.images) && s.images.length > 0;
  return hasImages;
});
// Result: Maybe 12 services (3 don't have images)

// Then re-sort and return 12 instead of 15
// UI: asked for 15, got 12 (inconsistent)
```

**Result:** Pagination promise broken - requested 15, returned 12

---

### Issue #4: Redundant Re-sorting

**What happens:**
```typescript
// Database sorts by orderCount (popular)
// Returns: Top 15 by orderCount

// Then in routes.ts:
const rankedLimit = 1000;
let rankedDetectives = await getRankedDetectives({ limit: rankedLimit });
// Fetches 1000 detectives with visibility scores (expensive!)

const detectiveRankMap = new Map(rankedDetectives.map((d: any, idx: number) => [d.id, { score: d.visibilityScore, rank: idx }]));

// Re-sort results by detective ranking
servicesWithImages.sort((a, b) => {
  const aRank = detectiveRankMap.get(a.detectiveId);
  const bRank = detectiveRankMap.get(b.detectiveId);
  return bRank.score - aRank.score;
});
// Result: Top 15 by detective visibility (not by service popularity)
```

**Result:** 
- Database sort by popularity ignored
- Client-side sort by detective ranking takes over
- SortBy=popular actually sorts by detective visibility
- Loads 1000 ranked detectives (overhead)

---

## Verification Table

### Confirmed Facts

| Question | Answer | Evidence | Line |
|----------|--------|----------|------|
| LIMIT in SQL? | ✅ YES | `query.limit(cappedLimit).offset(offset)` | 993 |
| .slice() in JS? | ✅ NO | No .slice() in routes.ts | — |
| SELECT *? | ✅ NO | 21 specific fields selected | 915-934 |
| Joins optimized? | ⚠️ PARTIAL | 4 JOINs, 1 unused (users) | 978-981 |
| N+1 query? | ⚠️ EDGE CASE | UPDATE in loop for missing slugs | 1001-1008 |

### Bugs Found

| Bug | Severity | Status |
|-----|----------|--------|
| minPrice/maxPrice ignored | HIGH | Unfixed |
| popular sort hardcoded to 15 | CRITICAL | Unfixed |
| Post-pagination filtering | HIGH | Unfixed |
| Redundant re-sorting | MEDIUM | Unfixed |

---

## Optimization Recommendations

### Priority 1: CRITICAL
1. **Remove popular sort limit override** - Allow requested limit to be honored
2. **Implement price filtering** - Apply minPrice/maxPrice in WHERE clause
3. **Fix post-pagination filter** - Move image check to SQL or accept services without images

### Priority 2: HIGH
4. **Remove unused users JOIN** - Saves 1 LEFT JOIN
5. **Consolidate sorting** - Don't re-sort in JavaScript, let database handle it
6. **Reduce ranked detectives load** - Only load detectives for searched services

### Priority 3: MEDIUM
7. **Fix slug generation N+1** - Batch update missing slugs instead of loop
8. **Validate offset bounds** - Prevent offset beyond result set

---

## Query Metrics

| Metric | Value | Note |
|--------|-------|------|
| **Columns Selected** | 21 | Specific fields, not SELECT * |
| **JOINs** | 4 | LEFT JOINs: detectives, users, subscriptionPlans, reviewsAgg |
| **WHERE Conditions** | 7 | isActive, category, search, country, state, city, plan, level |
| **Subqueries** | 1 | Reviews aggregation in FROM clause |
| **Sorting Options** | 5 | popular, rating, price_low, price_high, recent |
| **Pagination** | LIMIT + OFFSET | Applied in SQL ✅ |
| **Caching** | 60 seconds | Public cache, TTL 60s |
| **Response Fields** | ~20 per service | Services + detective data + ratings |

---

**Analysis Date:** February 19, 2026  
**Status:** ✅ COMPLETE  
**Issues Found:** 7 (4 bugs, 3 optimizations)
