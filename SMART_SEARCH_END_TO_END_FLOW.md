# Smart Search - Complete End-to-End Flow

**Last Updated:** February 10, 2026

---

## Executive Summary

The smart search system is a **multi-layer filtering and ranking architecture** that:
1. Accepts filter inputs from the user (category, location, price, subscription level, etc.)
2. **Applies database-level filtering** (efficient SQL WHERE clauses)
3. **Ranks results by detective visibility score** (relevance and engagement metrics)
4. **Masks sensitive data** (contact info for anonymous users)
5. **Caches results** for anonymous users (60 second TTL)

**Key Insight:** Category selection is **authoritative** - when a category is selected (manually or via Smart Search), it uses **strict exact matching** (SQL `eq`, not fuzzy `ILIKE`). Ranking applies **ONLY within the selected category** - the category boundary cannot be crossed by ranking scores.

**Smart Search Responsibility:** Smart Search determines the MOST RELEVANT category based on user intent. Once determined, this category selection is enforced strictly, and ranking only decides which service is best INSIDE that category.

---

## Smart Search Architecture Philosophy

### Core Principles

**1. Category Selection is Authoritative**
- Smart Search (or user manual selection) determines ONE category
- This category is enforced with strict exact matching: `services.category = 'Private Investigation'`
- NO fuzzy matching, NO cross-category results

**2. Ranking Scope is Bounded by Category**
- Ranking ONLY reorders services WITHIN the selected category
- A "Background Check" service with score 500 will NOT appear in "Private Investigation" results (score 100)
- Category boundaries are absolute - ranking cannot cross them

**3. Separation of Concerns**
```
Smart Search → "What category does the user need?"
Database Filter → "Get ALL services in that category"
Ranking System → "Which service in this category is most relevant?"
```

**4. Two Search Modes**

| Mode | When Used | Matching | Scope |
|------|-----------|----------|-------|
| **Category Filter** | Category selected (Smart Search or manual) | Strict `eq` | Single category only |
| **Search Query** | No category selected | Fuzzy `ILIKE` | Across title, description, all categories |

### Example: Smart Search Flow

**User Query:** "I need someone to find my missing relative"

```
Step 1: Smart Search Analysis
  Input: "find my missing relative"
  Output: category = "Missing Persons Investigation"
  
Step 2: Backend Enforcement
  SQL: WHERE services.category = 'Missing Persons Investigation'
  Result: 12 services in this category
  
Step 3: Ranking (Within Category)
  Detective A (category: Missing Persons, score: 280) → Rank 1
  Detective B (category: Missing Persons, score: 150) → Rank 2
  Detective C (category: Background Checks, score: 500) → NOT INCLUDED (wrong category)
  
Step 4: Display
  User sees: 12 "Missing Persons Investigation" services, ordered by ranking
```

**Key Insight:** Detective C has the highest score globally, but doesn't appear because they're in the wrong category. Category selection is the PRIMARY filter; ranking is SECONDARY ordering within that category.

---

## Flow Diagram

```
USER INPUT (Search Page)
    ↓
[Frontend: search.tsx]
    ├─ Read filters from URL params
    ├─ Collect selected filters (category, country, price, etc)
    ├─ Use useReducer to manage filter state atomically
    └─ Call useSearchServices() React Query hook
        ↓
[Frontend: hooks.ts - useSearchServices()]
    ├─ Build query params object
    ├─ Call api.services.search(params)
    └─ Make GET request to /api/services?category=...&country=...
        ↓
[Backend: routes.ts - GET /api/services]
    ├─ Check cache for results (skip if authenticated)
    ├─ Extract filter params from query string
    ├─ Call storage.searchServices(filters) ← MAIN FILTERING
    ├─ Get results as paginated array
    ├─ Fetch ranked detective list
    ├─ Sort services by detective ranking scores
    ├─ Mask detective contact info (for anonymous users)
    ├─ Cache results (60s for anonymous)
    └─ Return JSON response
        ↓
[Frontend: search.tsx]
    ├─ Map services to ServiceCard components
    ├─ Apply client-side price conversion filter (different currencies)
    ├─ Display in grid or list
    └─ User sees results
```

---

## PHASE 1: Frontend - User Input & Filter Collection

**File:** [client/src/pages/search.tsx](client/src/pages/search.tsx)

### 1.1 Search Page Initialization

```tsx
// Line 160-190: Read initial filters from URL parameters
const searchParams = new URLSearchParams(window.location.search);
const query = searchParams.get("q") || "All Services";

// Initialize filter state from URL params
const [filters, dispatch] = useReducer(filterReducer, {
  category: searchParams.get("category") || undefined,
  country: searchParams.get("country") || undefined,
  state: searchParams.get("state") || "",
  city: searchParams.get("city") || "",
  minPrice: searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined,
  maxPrice: searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined,
  minRating: searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : undefined,
  proOnly: searchParams.get("proOnly") === "1",
  agencyOnly: searchParams.get("agencyOnly") === "1",
  level1Only: searchParams.get("lvl1") === "1",
  level2Only: searchParams.get("lvl2") === "1",
  sortBy: searchParams.get("sortBy") || "popular",
  offset: 0,
  limit: 50,
});
```

### 1.2 Filter Reducer - Atomic State Management

```typescript
// Lines 70-105: filterReducer function
type FilterAction =
  | { type: 'SET_CATEGORY'; payload?: string }
  | { type: 'SET_COUNTRY'; payload?: string }
  | { type: 'SET_MIN_PRICE'; payload?: number }
  | { type: 'SET_MAX_PRICE'; payload?: number }
  | { type: 'SET_STATE'; payload: string }
  | ... (more actions)

// Example: When user clicks a category
dispatch({ type: 'SET_CATEGORY', payload: 'Private Investigation' });
// Reducer returns: { ...state, category: 'Private Investigation', offset: 0 }
```

**Why useReducer?**
- ✅ Atomic state updates (prevents race conditions)
- ✅ Multiple independent filters in one state tree
- ✅ URL sync after every filter change
- ✅ Clear action intent (what changed)

### 1.3 Category Selection UI

**File:** [client/src/pages/search.tsx:260-320](client/src/pages/search.tsx#L260-L320)

```tsx
// Render category buttons
{categories.map((cat) => (
  <button
    key={cat.id}
    onClick={() => dispatch({ 
      type: 'SET_CATEGORY', 
      payload: filters.category === cat.name ? undefined : cat.name 
    })}
  >
    <span>{cat.name}</span>
    {filters.category === cat.name && <Check className="h-4 w-4" />}
  </button>
))}
```

**Action:** 
1. User clicks "Private Investigation" button
2. dispatch({ type: 'SET_CATEGORY', payload: 'Private Investigation' })
3. Reducer updates state: `filters.category = 'Private Investigation'`
4. Component re-renders
5. useEffect triggers (line 250) → URL updated to `?category=Private+Investigation`
6. useSearchServices hook observes filter change

### 1.4 Building Query Parameters

```typescript
// Lines 240-250
const planName = filters.proOnly ? "pro" : filters.agencyOnly ? "agency" : undefined;
const level = filters.level1Only ? "level1" : filters.level2Only ? "level2" : undefined;

// Call React Query hook with all filters
const { data: servicesData, isLoading } = useSearchServices({
  search: filters.category ? undefined : (query !== "All Services" ? query : undefined),
  country: filters.country || undefined,
  state: filters.state || undefined,
  city: filters.city || undefined,
  category: filters.category,  // ← EXACT CATEGORY NAME PASSED HERE
  minRating: filters.minRating,
  minPrice: filters.minPrice,
  maxPrice: filters.maxPrice,
  planName,
  level,
  sortBy: filters.sortBy,
  limit: filters.limit,
  offset: filters.offset,
});
```

**Key Detail:** When category is selected:
- `category: 'Private Investigation'` is passed to React Query
- searchQuery (`search` param) is set to `undefined`
- Backend will use CATEGORY filter, not text search

---

## PHASE 2: Frontend React Query Hook

**File:** [client/src/lib/hooks.ts:178-200](client/src/lib/hooks.ts#L178-L200)

```typescript
export function useSearchServices(params?: {
  category?: string;
  country?: string;
  state?: string;
  city?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  minRating?: number;
  planName?: string;
  level?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["services", "search", params],
    queryFn: () => api.services.search(params),
    // ⚠️ Override: Dashboard caching disabled
    staleTime: 0,                      // Always fetch fresh
    gcTime: 0,                         // Don't keep in memory
    refetchOnMount: "always",          // Refetch on component mount
  });
}
```

### 2.1 React Query Configuration

**Configuration Details:**
- `queryKey`: `["services", "search", params]` - Unique key includes all params
  - If params change → new query
  - If params same → reuses cached data for 0ms (immediately stale)
- `queryFn`: Calls `api.services.search(params)` - Makes HTTP GET request

### 2.2 API Call

**File:** [client/src/lib/api.ts](client/src/lib/api.ts)

```typescript
services: {
  search: (params: SearchParams) => 
    client.get("/api/services", { params })
      .then(r => r.data)
}
```

This translates to:
```
GET /api/services?category=Private+Investigation&country=US&limit=50&offset=0&sortBy=popular
```

---

## PHASE 3: Backend - Main Search Endpoint

**File:** [server/routes.ts:3214-3310](server/routes.ts#L3214-L3310)

### 3.1 Endpoint Handler

```typescript
app.get("/api/services", async (req: Request, res: Response) => {
  try {
    // Extract all filters from query params
    const { 
      category,      // ← 'Private Investigation'
      country,       // ← 'US'
      state,         // ← optional
      city,          // ← optional
      search,        // ← optional (full-text search)
      minPrice,      // ← optional
      maxPrice,      // ← optional
      minRating,     // ← optional
      planName,      // ← 'pro' or 'agency'
      level,         // ← 'level1' or 'level2'
      limit = "20",
      offset = "0",
      sortBy = "popular"
    } = req.query;
```

### 3.2 Cache Key Generation

**Lines 3218-3220:**

```typescript
const stableParams = [
  "category", "country", "search", "minPrice", "maxPrice", 
  "minRating", "planName", "level", "limit", "offset", "sortBy"
].sort()  // ← SORT to normalize different param orders
 .map(k => `${k}=${String((req.query as Record<string, string>)[k] ?? "").trim()}`)
 .join("&");

const cacheKey = `services:search:category=&country=US&level=&limit=50&minPrice=&minRating=&offset=0&planName=&search=&sortBy=popular`;
```

**Example key:** `services:search:category=Private Investigation&country=US&limit=50&offset=0&sortBy=popular`

### 3.3 Cache Check (Unauthenticated Users Only)

```typescript
const skipCache = !!(req.session?.userId);  // Skip if logged in

if (!skipCache) {
  const cached = cache.get<{ services: unknown[] }>(cacheKey);
  if (cached != null && Array.isArray(cached.services)) {
    console.debug("[cache HIT]", cacheKey);
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    sendCachedJson(req, res, cached);  // Return cached response
    return;  // ✅ Early exit - no database hit
  }
}
```

### 3.4 Call Storage Layer with Filters

**Line 3246:**

```typescript
const allServices = await storage.searchServices({
  category: category as string,        // ← Passed to storage
  country: country as string,
  state: state as string,
  city: city as string,
  searchQuery: search as string,
  minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
  maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
  ratingMin: minRating ? parseFloat(minRating as string) : undefined,
  planName: planName as string,
  level: level as string,
}, limitNum, offsetNum, sortBy as string);
```

---

## PHASE 4: Backend Storage Layer - Database Filtering

**File:** [server/storage.ts:557-700](server/storage.ts#L557-L700)

### 4.1 Build WHERE Conditions

```typescript
async searchServices(filters: {
  category?: string;           // 'Private Investigation'
  country?: string;            // 'US'
  state?: string;
  city?: string;
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  ratingMin?: number;
  planName?: string;
  level?: string;
}, limit: number, offset: number, sortBy: string) {

  // Start with base condition - only active services
  const conditions = [ eq(services.isActive, true) ];

  // ✅ STRICT CATEGORY MATCHING - Authoritative selection
  // Smart Search determines category → Backend enforces EXACT match
  // Ranking applies ONLY within this category (cannot cross category boundaries)
  if (filters.category) {
    // Use `eq` for exact match (not fuzzy ILIKE)
    // 'Private Investigation' matches ONLY:
    //   - 'Private Investigation' ✅ (exact match only)
    // Does NOT match:
    //   - 'Professional Private Investigation Services' ❌ (fuzzy match disabled)
    //   - 'private investigation' ❌ (case-sensitive enforcement)
    conditions.push(eq(services.category, filters.category.trim()));
  }

  // Location filters - exact match on detective location
  if (filters.country) {
    conditions.push(eq(detectives.country, filters.country));
  }
  if (filters.state) {
    conditions.push(ilike(detectives.state, filters.state));
  }
  if (filters.city) {
    conditions.push(ilike(detectives.city, filters.city));
  }

  // Subscription plan filter
  if (filters.planName) {
    conditions.push(eq(subscriptionPlans.name, filters.planName));  // 'pro' or 'agency'
  }

  // Detective level filter
  if (filters.level) {
    conditions.push(eq(detectives.level, filters.level));  // 'level1' or 'level2'
  }

  // Full-text search in title, description, category
  if (filters.searchQuery) {
    const searchCondition = or(
      ilike(services.title, `%${filters.searchQuery}%`),
      ilike(services.description, `%${filters.searchQuery}%`),
      ilike(services.category, `%${filters.searchQuery}%`)
    );
    conditions.push(searchCondition);
  }
```

### 4.2 Build SQL Query with JOINs

```typescript
  // Create reviews aggregation subquery (avoid cartesian product)
  const reviewsAgg = db.select({
    serviceId: reviews.serviceId,
    avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
    reviewCount: count(reviews.id),
  })
  .from(reviews)
  .where(eq(reviews.isPublished, true))
  .groupBy(reviews.serviceId)
  .as('reviews_agg');

  // Build main query
  let query = db.select({
    serviceId: services.id,
    serviceTitle: services.title,
    serviceCategory: services.category,     // ← The category field
    serviceBasePrice: services.basePrice,
    serviceImages: services.images,
    
    // Detective info
    detectiveId: detectives.id,
    detectiveBusinessName: detectives.businessName,
    detectiveLevel: detectives.level,
    detectiveCountry: detectives.country,
    
    // Subscription
    planName: subscriptionPlans.name,
    
    // Ratings
    avgRating: reviewsAgg.avgRating,
    reviewCount: reviewsAgg.reviewCount,
  })
  .from(services)
  .leftJoin(detectives, eq(services.detectiveId, detectives.id))
  .leftJoin(users, eq(detectives.userId, users.id))
  .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
  .leftJoin(reviewsAgg, eq(services.id, reviewsAgg.serviceId))
  .where(and(...conditions));  // ← Apply ALL WHERE conditions here
```

### 4.3 Apply Additional Filters & Sorting

```typescript
  // Price range filter (in WHERE)
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    // Note: This happens in SQL WHERE clause in real code
  }

  // Rating filter (in HAVING - for aggregated values)
  if (filters.ratingMin !== undefined) {
    query = query.having(sql`COALESCE(${reviewsAgg.avgRating}, 0) >= ${filters.ratingMin}`);
  }

  // Sorting
  if (sortBy === 'popular') {
    query = query.orderBy(desc(services.orderCount));  // Most orders first
  } else if (sortBy === 'rating') {
    query = query.orderBy(desc(reviewsAgg.avgRating));  // Highest rated first
  } else if (sortBy === 'price_low') {
    query = query.orderBy(services.basePrice);  // Cheapest first
  } else if (sortBy === 'price_high') {
    query = query.orderBy(desc(services.basePrice));  // Most expensive first
  } else {
    query = query.orderBy(desc(services.createdAt));  // Newest first (default 'recent')
  }

  // Pagination
  const results = await query.limit(limit).offset(offset);  // Fetch 50 from position 0
```

**Generated SQL (Simplified):**
```sql
SELECT 
  s.id, s.title, s.category, s.base_price, s.images,
  d.id, d.business_name, d.level, d.country,
  p.name as plan_name,
  AVG(r.rating) as avg_rating, COUNT(r.id) as review_count
FROM services s
LEFT JOIN detectives d ON s.detective_id = d.id
LEFT JOIN subscription_plans p ON d.subscription_package_id = p.id
LEFT JOIN (
  SELECT service_id, AVG(rating) as avg_rating, COUNT(id) as review_count
  FROM reviews
  WHERE is_published = true
  GROUP BY service_id
) r ON s.id = r.service_id
WHERE
  s.is_active = true
  AND s.category = 'Private Investigation'    -- EXACT match (eq, not ILIKE)
  AND d.country = 'US'
  AND p.name = 'pro'
ORDER BY s.order_count DESC
LIMIT 50 OFFSET 0;

-- Note: Ranking happens AFTER this query returns results
-- Ranking only reorders services WITHIN 'Private Investigation' category
-- Services from other categories are excluded by WHERE clause
```

### 4.4 Database Indexes for Performance

**File:** [supabase/migrations/20260210_add_search_performance_indexes.sql](supabase/migrations/20260210_add_search_performance_indexes.sql)

```sql
-- Index for category + country filtering
CREATE INDEX idx_services_category_detective_country 
ON services(category, detective_id) 
WHERE is_active = true;

-- Index for detective location lookups
CREATE INDEX idx_detectives_country_state_city 
ON detectives(country, state, city) 
WHERE status = 'active';

-- Index for plan filtering
CREATE INDEX idx_detectives_subscription_package 
ON detectives(subscription_package_id) 
WHERE status = 'active';

-- Index for level filtering
CREATE INDEX idx_detectives_level 
ON detectives(level) 
WHERE status = 'active';
```

**Why?** Without these, category filtering would do a **full table scan** on the services table (slow). With indexes, it's a fast lookup.

---

## PHASE 5: Backend Ranking - Result Reordering

**After** the database returns filtered services, the backend applies **detective ranking** to determine display order.

### 5.1 Fetch Ranked Detectives

**File:** [server/routes.ts:3258-3280](server/routes.ts#L3258-L3280)

```typescript
// Fetch ranked detective list (cached for 2 minutes)
const rankedCacheKey = `ranked:1000`;
let rankedDetectives = getRankedDetectivesCache(rankedCacheKey);

if (!rankedDetectives) {
  const { getRankedDetectives } = await import("./ranking");
  // Fetch top 1000 detectives by visibility/engagement score
  rankedDetectives = await getRankedDetectives({ limit: 1000 });
  
  // Cache for 2 minutes
  setRankedDetectivesCache(rankedCacheKey, rankedDetectives);
}

// Create a map for O(1) lookup: detectiveId → { score, rank }
const detectiveRankMap = new Map(
  rankedDetectives.map((d: any, idx: number) => [
    d.id, 
    { score: d.visibilityScore, rank: idx }
  ])
);
```

### 5.2 What is Visibility Score?

**File:** [server/ranking.ts:266-400](server/ranking.ts#L266-L400)

```typescript
export async function getRankedDetectives(options?: { limit?: number }) {
  // Query detective visibility data
  // Fetch subscription plans
  // Fetch services for each detective
  // Aggregate reviews
  
  // Calculate visibility score for each detective
  const rankedDetectives = detList.map((detective) => {
    const visibility = visibilityMap.get(detective.id);
    const services = servicesByDetective.get(detective.id) || [];
    const reviews = reviewAggregates.get(detective.id) || { totalReviews: 0, avgRating: 0 };
    
    // VISIBILITY SCORE = weighted sum of:
    let score = 0;
    
    // 1. Number of services (services count)
    score += services.length * 10;
    
    // 2. Average rating (review quality)
    score += (reviews.avgRating || 0) * 20;
    
    // 3. Total reviews (social proof)
    score += (reviews.totalReviews || 0) * 5;
    
    // 4. Subscription plan level (pro/agency > base)
    const plan = packagesMap.get(detective.subscriptionPackageId);
    if (plan?.name === 'agency') score += 100;
    else if (plan?.name === 'pro') score += 50;
    
    // 5. Blue tick/verification
    if (detective.isVerified) score += 30;
    
    // 6. Detective level (pro level > level 2 > level 1)
    if (detective.level === 'pro') score += 40;
    else if (detective.level === 'level2') score += 20;
    
    return {
      id: detective.id,
      visibilityScore: score,
      businessName: detective.businessName
    };
  });
  
  // Sort by score (highest first)
  rankedDetectives.sort((a, b) => b.visibilityScore - a.visibilityScore);
  
  return rankedDetectives.slice(0, options?.limit || 100);
}
```

**Visibility Score Formula:**

```
Score = (serviceCount × 10) 
       + (avgRating × 20) 
       + (reviewCount × 5)
       + (planBonus: agency=100, pro=50, base=0)
       + (blueTick: yes=30, no=0)
       + (levelBonus: pro=40, level2=20, level1=0)
```

**Higher score = appears first in results**

### 5.3 Re-rank Services by Detective Score

**File:** [server/routes.ts:3281-3300](server/routes.ts#L3281-L3300)

```typescript
// Sort filtered services by detective ranking
const sortedResults = servicesWithImages.sort((a: any, b: any) => {
  const aRank = detectiveRankMap.get(a.detectiveId);
  const bRank = detectiveRankMap.get(b.detectiveId);
  
  // Higher score = appears first
  if (aRank && bRank) {
    return bRank.score - aRank.score;  // Descending
  }
  
  // Services with ranking appear before unranked
  if (aRank) return -1;
  if (bRank) return 1;
  return 0;
});
```

**Example:**
```
Service A - Detective John (score: 280, 8 services, 4.8 rating, 50 reviews, pro)
Service B - Detective Jane (score: 150, 2 services, 4.2 rating, 15 reviews, free)
Service C - Detective Bob (score: 280, 8 services, 4.8 rating, 50 reviews, pro)

Results Order: [Service A, Service C, Service B]
```

---

## PHASE 6: Data Masking & Response Preparation

### 6.1 Mask Sensitive Detective Data

**File:** [server/routes.ts:3286-3295](server/routes.ts#L3286-L3295)

For anonymous users, contact information is masked:

```typescript
const masked = await Promise.all(sortedResults.map(async (s: any) => {
  const maskedDetective = await maskDetectiveContactsPublic(s.detective);
  const effectiveBadges = computeEffectiveBadges(
    s.detective, 
    (s.detective as any).subscriptionPackage
  );
  return { 
    ...s, 
    detective: { ...maskedDetective, effectiveBadges } 
  };
}));
```

**What gets masked:**
- `phone` → hidden
- `whatsapp` → hidden
- `contactEmail` → hidden
- `email` → hidden

**What's visible:**
- `businessName` ✅
- `logo` ✅
- `isVerified` (blue tick) ✅
- `level` ✅
- Location (country, state, city) ✅

### 6.2 Cache the Result

```typescript
if (!skipCache) {
  try {
    // Store 50 services in memory cache for 60 seconds
    cache.set(cacheKey, { services: masked }, 60);
  } catch (_) {
    // Silent failure - don't break response
  }
}
```

### 6.3 Set Response Headers

```typescript
if (!skipCache) {
  // Anonymous: Allow public caching
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
} else {
  // Authenticated: No caching
  res.set("Cache-Control", "private, no-store");
}

// Send response
sendCachedJson(req, res, { services: masked });
```

---

## PHASE 7: Frontend Display

### 7.1 Process Results

**File:** [client/src/pages/search.tsx:165-180](client/src/pages/search.tsx#L165-L180)

```typescript
// Get services from React Query hook
const { data: servicesData, isLoading } = useSearchServices(params);

// Map services to card components
const results = servicesData?.services?.map(mapServiceToCard) || [];

// Apply client-side price conversion filter
// (prices stored in different currencies, need to convert)
const finalResults = results.filter((s) => {
  if (filters.minPrice === undefined && filters.maxPrice === undefined) return true;
  
  const converted = convertPriceFromTo(
    s.price, 
    s.countryCode, 
    selectedCountry.code
  );
  
  if (filters.minPrice !== undefined && converted < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && converted > filters.maxPrice) return false;
  return true;
});
```

### 7.2 Render Service Cards

```tsx
{finalResults.map((service) => (
  <ServiceCard key={service.id} {...service} />
))}
```

---

## Category Selection - Detailed Example

### Step-by-step: User selects "Private Investigation"

**1. User clicks category button**
```
Button: "Private Investigation"
onClick → dispatch({ type: 'SET_CATEGORY', payload: 'Private Investigation' })
```

**2. Reducer updates state**
```
Old: { category: undefined, offset: 0, ... }
New: { category: 'Private Investigation', offset: 0, ... }
```

**3. URL updated**
```
Old: /search?q=All+Services
New: /search?q=All+Services&category=Private+Investigation
```

**4. React Query hook observes change**
```
queryKey changed: ["services", "search", { category: 'Private Investigation', ... }]
New request triggered
```

**5. Frontend builds query params**
```
{
  category: 'Private Investigation',
  search: undefined,         // Not a text search
  country: undefined,
  limit: 50,
  offset: 0,
  sortBy: 'popular'
}
```

**6. HTTP request sent**
```
GET /api/services?category=Private+Investigation&limit=50&offset=0&sortBy=popular
```

**7. Backend creates WHERE condition (STRICT)**
```typescript
// Exact match enforced - category is authoritative
conditions.push(eq(services.category, 'Private Investigation'));
```

**8. SQL WHERE clause (EXACT MATCH)**
```sql
WHERE s.is_active = true 
  AND s.category = 'Private Investigation'  -- Exact match, not ILIKE
```

**9. Database index used**
```
Index: services(category, detective_id)
Result: ~15 services match this category
```

**10. Ranking applied (WITHIN CATEGORY ONLY)**
```
// All 3 services are in 'Private Investigation' category
// Ranking determines order WITHIN this category
Detective John (score 280) → Service A appears first
Detective Bob (score 280) → Service C appears second
Detective Jane (score 150) → Service B appears third

// Services from other categories (e.g., 'Background Checks') are NOT included
// even if their detectives have higher scores - category boundary is absolute
```

**11. Data masked**
```
Service A.detective.phone → hidden
Service A.detective.contactEmail → hidden
// But:
Service A.detective.businessName → "John's Detective Agency"
Service A.detective.isVerified → true
```

**12. Response sent**
```json
{
  "services": [
    {
      "id": "svc-123",
      "title": "Criminal Investigation",
      "category": "Private Investigation",
      "detective": {
        "id": "det-john",
        "businessName": "John's Detective Agency",
        "isVerified": true,
        "level": "pro",
        "phone": null,           // ← masked
        "contactEmail": null,    // ← masked
        "country": "US"
      },
      "avgRating": 4.8,
      "reviewCount": 50,
      "basePrice": 500
    },
    ...
  ]
}
```

**13. Frontend renders**
```tsx
<ServiceCard
  name="John's Detective Agency"
  category="Private Investigation"
  rating={4.8}
  reviews={50}
  price={500}
  isVerified={true}
  level="Pro Level"
/>
```

**14. User sees results**
```
┌─────────────────────────────────────┐
│ John's Detective Agency ✓ Pro Level │
│ ★★★★★ 4.8 (50 reviews)             │
│ Criminal Investigation              │
│ $500                                │
└─────────────────────────────────────┘
```

---

## Database Schema - Key Fields

### services table
```
id: UUID
title: string
category: string          ← Filtering happens on this field
description: text
base_price: numeric
offer_price: numeric (nullable)
detective_id: UUID (foreign key)
is_active: boolean
is_on_enquiry: boolean
images: text[] (JSON array of image URLs)
order_count: integer      ← Used for 'popular' sorting
created_at: timestamp     ← Used for 'recent' sorting
```

### detectives table
```
id: UUID
user_id: UUID
business_name: string
level: 'level1'|'level2'|'pro'
country: string           ← Location filtering
state: string
city: string
phone: string
whatsapp: string
contact_email: string
logo: text (URL)
is_verified: boolean      ← Blue tick
status: 'active'|'pending'|'suspended'
subscription_package_id: UUID (foreign key)
```

### subscription_plans table
```
id: UUID
name: 'free'|'pro'|'agency'
```

### reviews table
```
id: UUID
service_id: UUID
rating: integer (1-5)
is_published: boolean
```

---

## Performance Optimizations

### 1. **Database Indexes**
- `services(category, detective_id)` - Fast category lookup
- `detectives(country)` - Fast location filtering
- `detectives(subscription_package_id)` - Fast plan filtering
- `detectives(level)` - Fast level filtering

### 2. **Result Pagination**
- Only fetch 50 services at a time (not 10,000)
- Use LIMIT 50 OFFSET 0 in SQL
- Next page: LIMIT 50 OFFSET 50

### 3. **Batch Operations**
- Load all detective subscriptions in ONE query (not 50 queries)
- Load all reviews in ONE aggregation query (not per-service)
- Compute ranking once (cached for 2 minutes)

### 4. **Reply Aggregation Subquery**
```sql
-- Instead of:
LEFT JOIN reviews ON s.id = reviews.service_id  ← Creates 1 row per review (cartesian product)

-- Use:
LEFT JOIN (
  SELECT service_id, AVG(rating), COUNT(id)
  FROM reviews
  GROUP BY service_id
) reviews_agg ON s.id = reviews_agg.service_id  ← Only 1 row per service
```

### 5. **Field Selection**
Don't fetch unused columns:
```typescript
const reviewsAgg = db.select({
  serviceId: reviews.serviceId,           // Only these 3
  avgRating: sql`AVG(${reviews.rating})`,
  reviewCount: count(reviews.id),
}).from(reviews).groupBy(reviews.serviceId);
```

### 6. **Response Caching**
- Cache for 60 seconds (anonymous users)
- Skip cache for authenticated users (personalized data)
- Cache key = sorted query params (normalizes param order)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| **Cache Hit (Memory)** | ~10-50ms |
| **Database Miss** | ~200-400ms |
| **With Ranking Calculation** | ~300-500ms |
| **Browser Rendering** | ~100-200ms |
| **Total Round-trip** | 200-700ms |

### With Category Filter
```
Cache → 15 matches for "Private Investigation"
Rank → 15 detectives ranked
Sort → Order by visibility score
Response → 15 services (filtered to limit=50)
```

---

## Common Issues & Debugging

### Issue: Category not filtering results (No matches found)
**Check:**
1. **Is service.category EXACTLY "Private Investigation"?** (Strict match now - case-sensitive)
   - Use exact category name from `service_categories` table
   - No fuzzy matching - "Private Investigation" ≠ "private investigation"
2. **Are there services with this exact category?** Query the database:
   ```sql
   SELECT category, COUNT(*) FROM services WHERE is_active = true GROUP BY category;
   ```
3. **Is the service active?** (`WHERE is_active = true`)
4. **Check category name spelling** - even a space difference breaks the match

### Issue: Expected results not appearing (Wrong category selected)
**This is by design!** Category selection is authoritative:
- If you select "Private Investigation", you ONLY see services in that category
- Even if a "Background Check" service has a higher-ranked detective, it won't appear
- **Solution:** Smart Search should determine the correct category based on user intent

### Issue: Wrong sort order (within category)
**Check:**
1. Is detectiveId in rankedDetectives map?
2. Did ranking calculate correctly?
3. Is sortBy parameter passed correctly?
4. Remember: Ranking ONLY affects order WITHIN the selected category

### Issue: Fuzzy matching not working
**This is intentional!** The refactored system uses:
- **Category filter:** Strict exact match (`eq`) - authoritative selection
- **Search query:** Fuzzy match (`ilike`) - used when NO category selected
- If you need fuzzy search, don't select a category - use the search query instead

### Issue: Stale results shown
**Check:**
1. User authenticated? (skip cache)
2. React Query refetching? (staleTime: 0 enabled)
3. Browser cache? (Cache-Control header set)
4. Was category edited? (cache invalidated?)

### Issue: Slow search
**Check:**
1. Are database indexes created?
2. Is pagination used (LIMIT 50)?
3. Is groupBy used for reviews aggregation?
4. Are unnecessary fields selected?
5. Is ranking cached (2min TTL)?

---

## Key Takeaways

1. **Category Selection is Authoritative:** When a category is selected (manually or via Smart Search), it's enforced with strict exact matching: `eq(services.category, 'Category Name')` - NO fuzzy matching
2. **Ranking Scope:** Ranking applies ONLY within the selected category - category boundaries are absolute and cannot be crossed by ranking scores
3. **Smart Search Responsibility:** Smart Search determines THE most relevant category based on user intent; backend enforces this decision strictly
4. **Search Query vs Category Filter:** Full-text search (`searchQuery`) uses fuzzy ILIKE across title/description/category when NO category is selected; category filter uses exact `eq` matching
5. **Performance:** Achieved through indexes, pagination, aggregation, caching
6. **Data Masking:** Contact info hidden for anonymous users only
7. **Cache Layers:** Backend (60s) + HTTP (300s SWR) + Client (React Query staleTime:0)
8. **End-to-End:** URL filters → React Query → Backend WHERE (strict category) → Ranking (within category) → Masking → Response

---

**Diagram: Full Data Flow**

```
┌──────────────────────────────────────────────────────────────────┐
│                      SMART SEARCH ARCHITECTURE                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [Frontend]                                                        │
│  ├─ User selects category: "Private Investigation"               │
│  ├─ Filter state: { category: 'Private Investigation' }          │
│  ├─ URL: /search?category=Private+Investigation                  │
│  └─ React Query: GET /api/services?category=...                  │
│                          ↓                                         │
│  [Backend - Cache Layer]                                          │
│  ├─ Check: cached[cacheKey]                                      │
│  ├─ Hit? → Return 10-50ms                                        │
│  └─ Miss → Continue                                              │
│                          ↓                                         │
│  [Backend - Database Query]                                       │
│  ├─ WHERE s.is_active = true                                     │
│  ├─ AND s.category ILIKE '%Private Investigation%'              │
│  ├─ AND d.country = 'US'                                         │
│  ├─ AND p.name = 'pro'                                           │
│  ├─ Fetch 50 services (pagination)                               │
│  └─ Execute: ~150-200ms                                          │
│                          ↓                                         │
│  [Backend - Ranking System]                                       │
│  ├─ Load ranked detectives (cached 2min)                         │
│  ├─ Build detectiveRankMap                                       │
│  ├─ Sort services by detective score                             │
│  └─ Process: ~50-100ms                                           │
│                          ↓                                         │
│  [Backend - Data Preparation]                                     │
│  ├─ Mask detective contact info                                  │
│  ├─ Compute effective badges                                     │
│  ├─ Store in cache (60s TTL)                                     │
│  └─ Process: ~50ms                                               │
│                          ↓                                         │
│  [Response]                                                        │
│  ├─ ✅ 15 Private Investigation services                         │
│  ├─ Ranked by visibility score                                   │
│  ├─ Sorted by popular (order_count DESC)                         │
│  └─ Contact info masked                                          │
│                          ↓                                         │
│  [Frontend - Display]                                             │
│  ├─ Map to ServiceCard components                                │
│  ├─ Apply client-side price conversion                           │
│  └─ Render 15 cards to user                                      │
│                          ↓                                         │
│  [User Interface]                                                 │
│  ├─ "Private Investigation" selected in filter                   │
│  ├─ 15 matching services displayed                               │
│  └─ Highest-ranked detectives appear first                       │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

**Document Generated:** February 10, 2026
**Last Updated:** 2026-02-10
**Status:** Complete end-to-end architecture documentation
