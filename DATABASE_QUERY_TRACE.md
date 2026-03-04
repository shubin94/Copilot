# Database Query Trace Analysis

## Overview
This document traces all database queries executed in the critical SSR and API path for the detective location listing page (`/detectives/:country/:state/:city`).

**Critical Path:**
1. `index-prod.ts` (lines 68–180) - SSR handler for location page
2. `seo-injection.ts` (lines 621, 1066) - Detective fetching and SEO metadata generation
3. `routes.ts` (lines 6767–6860) - `/api/detectives/location` API endpoint

---

## Query 1: getLocationDetectivesForSEO() - Main Detective Listing

**Location:** [seo-injection.ts](seo-injection.ts#L621-L720)

### ORM Call
```typescript
const rows = await db
  .select({
    id: detectives.id,
    businessName: detectives.businessName,
    slug: detectives.slug,
    city: detectives.city,
    state: detectives.state,
    country: detectives.country,
    logo: detectives.logo,
    bio: detectives.bio,
    phone: detectives.phone,
    whatsapp: detectives.whatsapp,
    contactEmail: detectives.contactEmail,
    isVerified: detectives.isVerified,
    level: detectives.level,
    subscriptionPackageId: detectives.subscriptionPackageId,
    subscriptionExpiresAt: detectives.subscriptionExpiresAt,
    blueTickAddon: detectives.blueTickAddon,
  })
  .from(detectives)
  .where(and(...conditions))
  .orderBy(desc(detectives.lastActive))
  .limit(limitValue + 1);
```

### SQL Equivalent
```sql
SELECT id, businessName, slug, city, state, country, logo, bio, phone, 
       whatsapp, contactEmail, isVerified, level, subscriptionPackageId, 
       subscriptionExpiresAt, blueTickAddon
FROM detectives
WHERE status = 'active' 
  AND country = 'IN' (or normalized country from slug)
  AND state = 'Normalized State' (if provided)
  AND city = 'Normalized City' (if provided)
ORDER BY lastActive DESC
LIMIT 16;  -- limit + 1 for hasMore detection
```

### Tables Accessed
- `detectives` (primary table)

### Joins Used
- **None** - single table query

### Indexes Required
- **Primary:** Index on `(status, country)` or `(status, country, state)` or `(status, country, state, city)`
  - Supports filtering by status + country (minimum)
  - Should be composite index: `detectives(status, country, state, city)` for best performance
- **Secondary:** Index on `lastActive DESC` for ORDER BY
  - Consider: `detectives(status, country, lastActive DESC)` as covering index
- **Missing Index Risk:** ⚠️ **HIGH** - If no composite index on (status, country, state, city), query will scan large portions of detectives table

### Estimated Dataset Size
- **Table Size:** ~10,000–100,000 detectives globally
- **Query Result:** 15–16 rows (hardcoded limit + 1)
- **Selectivity:** Low (country filter alone may match 100–2,000 rows; state/city drastically reduces)
- **Example (India, Maharashtra):**
  - ~1,000–3,000 detectives in India
  - ~300–800 detectives in Maharashtra
  - ~50–200 detectives in Pune (city-level)
  - Query returns top 15 by lastActive

### Sequential vs. Parallelizable
- **Execution:** SEQUENTIAL (called first in index-prod.ts line 89)
- **Parallelization Opportunity:** ✅ CAN BE PARALLELIZED
  - If calling alongside `generateLocationSeoMetaTags()` or other metadata fetches, run in parallel
  - Currently awaited sequentially (line 89: `await getLocationDetectivesForSEO()`)

### Performance Characteristics
- **Latency:** ~50–200ms (depends on index quality + country cardinality)
- **Risk Level:** 🔴 **HIGH if no index**
  - Without composite index: full table scan on 10k–100k rows = 1–5 seconds
  - With index: ~50–200ms (index seek + 15 row fetch)

### Query Optimization Notes
- ✅ **Limit + 1 trick:** Efficient pagination without counting total rows
- ✅ **No subquery:** Direct filtering avoids nested query overhead
- ⚠️ **Slug normalization:** Slug → title-case conversion happens in application code (not DB), so country code lookup is done separately via:
  ```typescript
  const countryCode = countrySlugToCode[country.toLowerCase()];
  const normalizedCountry = countryCode || slugToTitleCase(country);
  conditions.push(eq(detectives.country, normalizedCountry));
  ```
  This means multiple format checks (code lookup first, then fallback to slug case) which is acceptable but could be simplified

---

## Query 2: Subscription Plan Features Resolution (per detective)

**Location:** [routes.ts](routes.ts#L344-L420) - `maskDetectiveContactsPublic()`

### ORM Call (Optional fallback path)
```typescript
const freePlanId = await getFreePlanId();
const freePlan = await storage.getSubscriptionPlanById(freePlanId);
```
AND/OR
```typescript
const pkg = await storage.getSubscriptionPlanById(d.subscriptionPackageId);
```

### SQL Equivalent
```sql
SELECT id, name, features, isActive FROM subscription_plans
WHERE id = ? LIMIT 1;
```

### Tables Accessed
- `subscription_plans` (plan metadata)

### Joins Used
- **None** - direct lookup by ID

### Indexes Required
- **Primary:** Index on `subscription_plans(id)` - PRIMARY KEY (always indexed)
- **Note:** This query is cached; see `storage.getSubscriptionPlanById()` for cache implementation

### Estimated Dataset Size
- **Table Size:** ~10–20 subscription plans (static)
- **Query Result:** 1 row
- **Selectivity:** Very high (primary key lookup)

### Sequential vs. Parallelizable
- **Execution:** SEQUENTIAL per detective (called inside Promise.all map on line 6798)
- **Loop Count:** 15 detectives per request (typical limit)
- **Parallelization:** ⚠️ PARTIALLY - Called inside Promise.all on each detective (line 6798)
  ```typescript
  const maskedDetectives = await Promise.all(
    paginatedDetectives.map(async (d) => {
      const masked = await maskDetectiveContactsPublic(d);  // <-- 15x sequential calls
      ...
    })
  );
  ```
  - **Current:** Already parallelized via Promise.all
  - **Opportunity:** Cache subscription plan lookups outside the map to avoid 15 redundant queries

### Performance Characteristics
- **Latency:** ~5–10ms per lookup (cached) or ~20–50ms per lookup (uncached via storage)
- **Total Impact:** 15 × ~8ms = ~120ms per request (if all uncached)
- **Risk Level:** 🟡 **MEDIUM** - Redundant plan lookups
  - Functions correctly but called 15 times for potentially 1–3 unique plans
  - Already guarded by caching in `storage.getSubscriptionPlanById()`

### Query Optimization Notes
- ✅ **Caching:** Results are cached in storage layer (check storage.ts for cache logic)
- ⚠️ **Multiple calls per request:** Plan is fetched once per detective; could pre-fetch plans once and pass to mask function
- ✅ **Safe fallback:** Defaults to FREE plan if lookup fails

---

## Query 3: Location SEO Overrides (Metadata)

**Location:** [seo-injection.ts](seo-injection.ts#L863-L907) - `generateLocationSeoMetaTags()`

### SQL Call (Raw Pool Query)
```typescript
const seoOverrideQuery = await pool.query(
  `SELECT meta_title, meta_description, h1 
   FROM location_seo_overrides 
   WHERE entity_type = 'city' AND entity_id = $1::text 
   LIMIT 1`,
  [cityId]
);
// OR for state:
const seoOverrideQuery = await pool.query(
  `SELECT meta_title, meta_description, h1 
   FROM location_seo_overrides 
   WHERE entity_type = 'state' AND entity_id = $1::text 
   LIMIT 1`,
  [stateId]
);
// OR for country:
const seoOverrideQuery = await pool.query(
  `SELECT meta_title, meta_description, h1 
   FROM location_seo_overrides 
   WHERE entity_type = 'country' AND entity_id = $1::text 
   LIMIT 1`,
  [countryId]
);
```

### Tables Accessed
- `location_seo_overrides` (SEO metadata overrides)

### Joins Used
- **None** - single table query

### Indexes Required
- **Primary:** Composite index on `location_seo_overrides(entity_type, entity_id)` ✅ REQUIRED
- **Risk:** ⚠️ **CRITICAL** - If index missing, scans entire location_seo_overrides table
  - Table size: ~200–500 overrides (if populated)
  - Without index: ~50–200ms full scan
  - With index: ~5–10ms seek + fetch

### Estimated Dataset Size
- **Table Size:** ~100–500 rows (sparse; only locations with custom SEO)
- **Query Result:** 0–1 row
- **Selectivity:** Very high (two-column composite match)

### Sequential vs. Parallelizable
- **Execution:** SEQUENTIAL with earlier queries
- **Called from:** [index-prod.ts](index-prod.ts#L130) → `injectLocationSeoTags()` → `generateLocationSeoMetaTags()` on line 1077
- **Parallelization Opportunity:** ✅ CAN BE PARALLELIZED
  - Can fetch detective listings AND SEO overrides in parallel
  - Current flow: await getLocationDetectives... → await injectLocationSeoTags() (which calls this query)
  - **Opportunity:** `Promise.all([getLocationDetectivesForSEO(), generateLocationSeoMetaTags()])` would save ~50–100ms

### Performance Characteristics
- **Latency:** ~5–50ms (depends on index presence)
- **Risk Level:** 🔴 **MEDIUM** - Sequential call, but fast query
- **Non-blocking:** Soft failure (falls back to system-generated SEO if query fails or table is empty)

### Query Optimization Notes
- ✅ **Single row result:** LIMIT 1 prevents unnecessary scans
- ✅ **Three-level fallback:** City → State → Country (efficient hierarchy)
- ⚠️ **Three separate queries:** Runs city query, if empty runs state query, if empty runs country query
  - Opportunity: Combine into single query with ORDER BY entity_type
- ✅ **Error resilience:** If query fails, system-generated SEO is returned (no user impact)

---

## Query 4: Background Check Services Existence Check (City-level pages only)

**Location:** [index-prod.ts](index-prod.ts#L130-L148) - Conditional services check on city pages

### ORM Call
```typescript
const servicesCheckResult = await storage.searchServices(
  {
    category: "Background Check",
    country: params.country,
    state: params.state,
    city: params.city,
  },
  1,   // limit = 1 (existence check only)
  0    // offset = 0
);
```

### SQL Equivalent (Simplified)
```sql
SELECT services.id, ... FROM services
LEFT JOIN detectives ON services.detectiveId = detectives.id
LEFT JOIN subscription_plans ON detectives.subscriptionPackageId = subscription_plans.id
LEFT JOIN (reviews aggregation) ON ...
WHERE services.isActive = true 
  AND services.category = 'Background Check'
  AND detectives.country = 'IN'
  AND detectives.state = 'Normalized State'
  AND detectives.city = 'Normalized City'
  AND services.images IS NOT NULL AND array_length(services.images, 1) > 0
ORDER BY services.createdAt DESC
LIMIT 1;
```

### Tables Accessed
- `services` (primary)
- `detectives` (LEFT JOIN)
- `subscription_plans` (LEFT JOIN)
- `reviews` (aggregated via subquery)
- `countries`, `states`, `cities` (location resolution, see [storage.ts L917-1050](storage.ts#L917-L1050))

### Joins Used
- **JOIN detectives:** `services.detectiveId = detectives.id` (LEFT JOIN)
- **JOIN subscription_plans:** `detectives.subscriptionPackageId = subscription_plans.id` (LEFT JOIN)
- **Aggregated reviews:** Via subquery `reviews_agg` (JOIN to reviews aggregation)
- **Location resolution JOINs (inside filters):**
  - `countries` table to resolve country ID (separate query before main query)
  - `states` table to resolve state ID (separate query before main query)
  - `cities` table to resolve city ID (separate query before main query)

### Indexes Required
- **Critical:** Index on `services(isActive, category, detectiveId)`
  - Supports filtering by isActive + category + detective location
- **Location resolution:** Indexes on:
  - `countries(slug)` or `countries(code)`
  - `states(slug, country_id)`
  - `cities(slug, state_id)`
- **Materialized View (for 'popular' sort):** `popular_service_per_detective`
  - Not used in this path (sortBy defaults to 'recent')

### Estimated Dataset Size
- **services table:** ~1,000–10,000 services globally
- **City-level cardinality:** ~10–100 background check services in Pune (city-level)
- **Query result:** 0–1 row (limit=1, existence check only)

### Sequential vs. Parallelizable
- **Execution:** SEQUENTIAL with other queries
- **Called from:** [index-prod.ts](index-prod.ts#L135) inside conditional block `if (pathSegments.length === 4)` (city-level pages only)
- **Parallelization Opportunity:** ✅ CAN BE PARALLELIZED
  - Can fetch detectives + check services in parallel (via Promise.all)
  - Currently awaited sequentially AFTER detective fetch completes
  - **Benefit:** Save ~100–300ms on city-level pages

### Performance Characteristics
- **Latency:** ~100–300ms (includes 3 location resolution queries + main services query)
- **Complexity:** HIGH (multiple joins, aggregation subquery)
- **Risk Level:** 🔴 **VERY HIGH** - Slowest query in the entire flow
  - Runs only on city-level pages (not state/country)
  - Combines 4 separate queries (country/state/city resolution + services search)
  - Includes expensive aggregation subquery for reviews

### Query Optimization Issues

#### ⚠️ Issue 1: Sequential Location Resolution (3 separate queries)
```typescript
// Query 1: Resolve country ID
const countryResult = await db.select({ id: countries.id })
  .from(countries)
  .where(or(eq(countries.slug, ...), eq(sql`LOWER(...)`, ...), eq(countries.code, ...)))
  .limit(1);

// Query 2: Resolve state ID  
const stateResult = await db.select({ id: states.id })
  .from(states)
  .where(or(eq(states.slug, ...), eq(sql`LOWER(...)`, ...)))
  .limit(1);

// Query 3: Resolve city ID
const cityResult = await db.select({ id: cities.id })
  .from(cities)
  .where(or(eq(cities.slug, ...), eq(sql`LOWER(...)`, ...)))
  .limit(1);
```
- **Problem:** 3 separate round-trips to DB instead of 1
- **Opportunity:** Combine into single query or cache location IDs
- **Impact:** ~50–150ms saved if parallelized or combined

#### ⚠️ Issue 2: Expensive Reviews Aggregation (Full Scan)
```typescript
const reviewsAgg = db.select({
  serviceId: reviews.serviceId,
  avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`.as('avg_rating'),
  reviewCount: count(reviews.id).as('review_count'),
})
.from(reviews)
.where(eq(reviews.isPublic, true))
.groupBy(reviews.serviceId)
.as('reviews_agg');
```
- **Problem:** Scans entire reviews table and groups by serviceId (even though only 1 service row will be fetched)
- **Opportunity:** Skip aggregation for existence checks; add optional aggregation flag
- **Impact:** ~100–200ms saved for existence check (limit=1)

#### ⚠️ Issue 3: Image Array Filtering (No Index)
```typescript
conditions.push(
  sql`${services.images} IS NOT NULL AND array_length(${services.images}, 1) > 0`
);
```
- **Problem:** Array function cannot use index; full table scan of services
- **Opportunity:** Add indexed `hasImages` boolean column or precomputed flag
- **Impact:** ~50–100ms if scanning 10k services

### Query Optimization Notes
- ⚠️ **For existence check (limit=1):** Skip complex aggregation and sorting
- ⚠️ **Cache location IDs:** Pre-resolve country/state/city once and reuse
- ✅ **Limit=1 optimization:** Only fetches 1 row (prevents large result set)
- 🔴 **BLOCKING POINT:** This is the slowest query in the SSR flow (100–300ms)

---

## Query 5: Additional Location ID Resolution (in generateLocationSeoMetaTags)

**Location:** [seo-injection.ts](seo-injection.ts#L804-L850) - Location name resolution

### ORM Calls
```typescript
// Resolve country
const countryResult = await db
  .select({ id: countries.id, name: countries.name })
  .from(countries)
  .where(eq(countries.slug, countrySlug))
  .limit(1);

// Resolve state (if exists)
const stateResult = await db
  .select({ id: states.id, name: states.name })
  .from(states)
  .where(and(
    eq(states.slug, stateSlug),
    eq(states.countryId, countryId)
  ))
  .limit(1);

// Resolve city (if exists)
const cityResult = await db
  .select({ id: cities.id, name: cities.name })
  .from(cities)
  .where(and(
    eq(cities.slug, citySlug),
    eq(cities.stateId, stateId)
  ))
  .limit(1);
```

### Tables Accessed
- `countries`
- `states`
- `cities`

### Joins Used
- **None** - separate queries

### Indexes Required
- `countries(slug)` - PRIMARY
- `states(slug, countryId)` - COMPOSITE
- `cities(slug, stateId)` - COMPOSITE

### Estimated Dataset Size
- Countries: ~200 rows (small table)
- States: ~5,000 rows (medium table)
- Cities: ~50,000 rows (medium-large table)
- Query results: 0–1 row each

### Sequential vs. Parallelizable
- **Execution:** SEQUENTIAL - state query depends on countryId, city query depends on stateId
- **Parallelization:** ❌ NOT PARALLELIZABLE (data dependency)
- **Called from:** `generateLocationSeoMetaTags()` which is called AFTER detective fetch (can be parallelized at higher level)

### Performance Characteristics
- **Latency:** ~50–100ms total (3 lookups, but small tables)
- **Risk Level:** 🟡 **MEDIUM** - Redundant with Query 4 location resolution
- **Optimization:** DUPLICATE WORK - Same location resolution happens in `searchServices()` location filtering

### Query Optimization Notes
- ⚠️ **REDUNDANT:** Same queries run in `searchServices()` location resolution on line 917-1050
- **Opportunity:** Cache location IDs from first resolution; pass to both functions
- **Impact:** Save ~50ms by caching location resolution

---

## Summary Table: All Queries in Request Path

| # | Query | File | Line | Table(s) | Joins | Latency | Risk | Parallelizable |
|---|-------|------|------|----------|-------|---------|------|---|
| 1 | getLocationDetectives | seo-injection.ts | 621 | `detectives` | None | 50–200ms | 🔴 HIGH (no index) | ✅ YES (currently sequential) |
| 2 | maskDetectiveContactsPublic (per detective) | routes.ts | 344 | `subscription_plans` | None | 8ms each × 15 | 🟡 MEDIUM (N+1) | ✅ YES (inside Promise.all) |
| 3 | location_seo_overrides fetch | seo-injection.ts | 863 | `location_seo_overrides` | None | 5–50ms | 🔴 MEDIUM (no index) | ✅ YES (currently sequential) |
| 4 | searchServices (city page only) | storage.ts | 917 | `services`, `detectives`, `subscription_plans`, `reviews` (agg) | 4 JOINs | 100–300ms ⚠️ | 🔴 VERY HIGH | ✅ YES (currently sequential) |
| 5 | Location resolution (countries/states/cities) | seo-injection.ts | 804 | `countries`, `states`, `cities` | None | 50–100ms | 🟡 MEDIUM (redundant) | ❌ NO (data dependency) |

---

## Critical Performance Bottlenecks

### 🔴 Bottleneck 1: searchServices() Query (Query 4)
- **Duration:** 100–300ms (SLOWEST)
- **Location:** [index-prod.ts L135](index-prod.ts#L135) - Only runs on city-level pages
- **Root Cause:** 
  - 3 sequential location resolution queries (countries → states → cities)
  - Expensive reviews aggregation with GROUP BY (scans entire reviews table)
  - Array filtering on images (no index)
- **Impact:** Can easily cause 60-second timeout on city pages if DB connection is slow
- **Fix:** Cache location IDs, skip aggregation for existence check, add `hasImages` boolean index

### 🔴 Bottleneck 2: Missing Index on detectives(status, country, state, city)
- **Duration:** Could be 1–5s if full scan instead of 50–200ms with index
- **Location:** [seo-injection.ts L660-700](seo-injection.ts#L660-L700) - getLocationDetectivesForSEO()'s WHERE clause
- **Root Cause:** No composite index on filtering columns
- **Impact:** Every page load scans 10k–100k detective records
- **Fix:** Create index `CREATE INDEX idx_detectives_location ON detectives(status, country, state, city)`

### 🔴 Bottleneck 3: Sequential Query Execution
- **Duration:** Cumulative inefficiency (50ms + 50ms + 100ms + 100ms = 300ms)
- **Location:** [index-prod.ts L89–148](index-prod.ts#L89-L148) - SSR handler orchestration
- **Root Cause:** Chains of await instead of Promise.all
- **Current Flow:**
  1. `await getLocationDetectivesForSEO()` - 50–200ms
  2. `await injectLocationSeoTags()` (which calls generateLocationSeoMetaTags()) - 50–100ms
  3. `await storage.searchServices()` (city page only) - 100–300ms
- **Opportunity:** Parallelize queries 1 & 3 (they're independent)
- **Fix:** `Promise.all([getLocationDetectivesForSEO(), storage.searchServices()])`

### 🟡 Bottleneck 4: Redundant Location Resolution
- **Duration:** 50–100ms (wasted)
- **Location:** Query 4 & 5 both resolve countries/states/cities
- **Root Cause:** `searchServices()` resolves location IDs AND `generateLocationSeoMetaTags()` resolves them again
- **Fix:** Cache location IDs from first resolution

### 🟡 Bottleneck 5: N+1 Subscription Plan Lookups
- **Duration:** 8ms × ~5 unique plans per request = ~40ms (worst case)
- **Location:** [routes.ts L6798](routes.ts#L6798) - maskDetectiveContactsPublic() called 15 times
- **Root Cause:** Plan lookup per detective (already cached, but suboptimal pattern)
- **Fix:** Pre-fetch all unique plans once; reuse in mask loop

---

## Recommended Index Additions

```sql
-- CRITICAL: Main detective listing query
CREATE INDEX idx_detectives_location 
ON detectives(status, country, state, city, lastActive DESC);

-- SEO overrides lookup
CREATE INDEX idx_location_seo_overrides_lookup 
ON location_seo_overrides(entity_type, entity_id);

-- Services search filtering
CREATE INDEX idx_services_category_active 
ON services(isActive, category);

-- Composite for location resolution
CREATE INDEX idx_countries_slug_code ON countries(slug, code);
CREATE INDEX idx_states_slug_country ON states(slug, countryId);
CREATE INDEX idx_cities_slug_state ON cities(slug, stateId);

-- Detective location resolution in searchServices
CREATE INDEX idx_detectives_country_id ON detectives(countryId);
CREATE INDEX idx_detectives_state_id ON detectives(stateId);
CREATE INDEX idx_detectives_city_id ON detectives(cityId);
```

---

## Parallelization Opportunities (Priority Order)

### ✅ High Priority: Parallelize Detective Fetch + Services Existence Check (City Pages)
**File:** [index-prod.ts](index-prod.ts#L89-L148)

**Current (Sequential):**
```typescript
const locationSeoData = await getLocationDetectivesForSEO(...);  // 50–200ms
// ... some processing ...
const servicesCheckResult = await storage.searchServices(...);   // 100–300ms
// Total: 150–500ms sequential
```

**Optimized (Parallel):**
```typescript
const [locationSeoData, servicesCheckResult] = await Promise.all([
  getLocationDetectivesForSEO(...),
  pathSegments.length === 4 ? storage.searchServices(...) : Promise.resolve([])
]);
// Total: max(150–200ms, 100–300ms) = 100–300ms (parallel)
// Saves: 50–200ms
```

### ✅ High Priority: Parallelize Detective Fetch + SEO Metadata Generation
**File:** [index-prod.ts](index-prod.ts#L89-L110)

**Current (Sequential):**
```typescript
const locationSeoData = await getLocationDetectivesForSEO(...);        // 50–200ms
const seoHtml = await injectLocationSeoTags(...);                      // calls generateLocationSeoMetaTags() 50–100ms
// Total: 100–300ms sequential
```

**Root Cause:** `injectLocationSeoTags()` calls `generateLocationSeoMetaTags()` which runs location ID resolution and SEO override queries (independent of detective data).

**Optimized (Parallel):**
```typescript
// Split injectLocationSeoTags into two parts:
// Part 1: Get SEO metadata in parallel with detective fetch
const [locationSeoData, seoMetadata] = await Promise.all([
  getLocationDetectivesForSEO(...),
  generateLocationSeoMetaTags(...)  // Extract from injectLocationSeoTags
]);
// Part 2: Inject (no DB calls)
const seoHtml = injectLocationSeoTagsSync(cachedIndexHtml, seoMetadata);
// Saves: ~50ms
```

### ✅ Medium Priority: Cache Location IDs
**Consolidate** location resolution in `getLocationDetectivesForSEO()` and reuse in `generateLocationSeoMetaTags()`.

### ✅ Medium Priority: Optimize searchServices for Existence Checks
**File:** [storage.ts](storage.ts#L917-L1050)

Add a lightweight path for existence checks (limit=1):
```typescript
async searchServices(
  filters: {...},
  limit: number = 50,
  offset: number = 0,
  sortBy: string = 'recent',
  skipAggregation: boolean = false  // NEW FLAG
): Promise<...> {
  // ... build conditions ...
  
  if (skipAggregation && limit === 1) {
    // Fast path: no reviews aggregation, minimal sorting
    query = db.select({ serviceId: services.id })
      .from(services)
      .where(and(...conditions))
      .limit(1);
  } else {
    // Full query with aggregation and sorting
    // ... existing code ...
  }
}
```

**Saves:** ~100–150ms on city-level pages where existence check is the goal.

---

## Cold-Start Impact

All queries above are executed on **every cold-start** (first request after deployment). Additionally:

1. **Secrets Loading** (guardtime: 8s) - Queries `app_secrets` table
2. **Route Registration** (guardtime: 8s) - Registers all routes
3. **Database Validation** - Validates required tables exist
4. **Subscription Plan Seed** (L461-475 in routes.ts) - Queries `subscription_plans` during registerRoutes

**Result:** Cold-start cold add 8–16s to first request. Combined with SSR query delays (300–500ms), first request can exceed 60s Vercel timeout.

**Mitigation:** Defer non-critical startup tasks; defer subscription plan seed to background after response.

---

## Estimated Timing Breakdown (City Page, Warm Cache)

| Phase | Duration | Notes |
|-------|----------|-------|
| HTTP request → Express middleware | 5–10ms | Usually fast |
| getLocationDetectivesForSEO() | 50–200ms | ⚠️ **No index risk** |
| injectLocationSeoTags() → generateLocationSeoMetaTags() | 50–100ms | Includes location resolution + SEO override fetch |
| searchServices() (city pages only) | 100–300ms | ⚠️ **Slowest** |
| maskDetectiveContactsPublic() × 15 | 5–10ms | Cached plan lookups |
| renderLocationApp() | 50–100ms | React SSR |
| Response → Vercel | 5–10ms | Transmission |
| **TOTAL** | **250–730ms** | **Without optimizations** |

**With optimizations:**
- Parallelize detectives + services: saves 50–200ms
- Add missing indexes: saves 100–500ms (reduce full scans)
- Cache location IDs: saves 50ms
- Skip aggregation for existence check: saves 100–150ms
- **New total: 50–230ms** (3–7x faster)

---

## Key Takeaways

1. **Query 1 (getLocationDetectives)** - Needs composite index ASAP
2. **Query 4 (searchServices)** - Slowest query; parallelize + optimize aggregation
3. **Sequential execution** - Parallelize detective + services fetch on city pages
4. **Redundant location resolution** - Cache and reuse
5. **Cold-start overhead** - 8–16s on first request is killer; defer startup tasks

**Priority Fixes:**
1. Add `idx_detectives_location` index
2. Parallelize detective + services queries
3. Add skipAggregation flag to searchServices for existence check
4. Defer subscription plan seed to background
