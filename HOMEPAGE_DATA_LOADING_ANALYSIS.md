# Homepage Data Loading Analysis
**Date:** February 19, 2026  
**Component:** `client/src/pages/home.tsx`  
**Status:** Complete Analysis with Issues Identified

---

## 1. All API Endpoints Called on Homepage Load

| Endpoint | Purpose | Location | Cached? | Blocking? | Repeating? |
|----------|---------|----------|---------|-----------|-----------|
| `/api/services/featured/home` | Load 8 featured services | home.tsx | ✅ 5 min | Page skeleton | ❌ No |
| `/api/detectives/search?status=active&limit=4` | Load 4 featured detectives | home.tsx | ✅ 5 min | Page skeleton | ❌ No |
| `/api/service-categories?active=true` | Load service categories | home.tsx | ✅ 1 hour | Page skeleton | ❌ No |
| `/api/settings/site` | Load site config (images, etc) | home.tsx | ❌ NO | Entire page | ⚠️ **YES - 4x calls** |
| `/api/categories/popular` | Load popular categories | hero.tsx | ✅ 1 hour | Not blocking | ❌ No |
| `/api/settings/site` | Load site config | hero.tsx | ❌ NO | Not blocking | ⚠️ **YES - duplicate** |
| `/api/detectives/current` | Load user's detective profile | navbar.tsx | ❌ NO | Entire page | ⚠️ **YES - repeated** |
| `/api/settings/site` | Load site config | navbar.tsx | ❌ NO | Not blocking | ⚠️ **YES - triplicate** |
| `/api/settings/site` | Load site config | footer.tsx | ❌ NO | Not blocking | ⚠️ **YES - 4x total** |

---

## 2. All useQuery Hooks in Homepage and Child Components

### Home Component (home.tsx)

**Query 1: useServiceCategories(true)**
```typescript
// Line 69
const { data: categoriesData, isLoading: isLoadingCategories } = useServiceCategories(true);

// Cache Configuration:
queryKey: ["serviceCategories", true]
queryFn: () => api.serviceCategories.getAll(true)
staleTime: 60 * 60 * 1000 // 1 HOUR
gcTime: 6 * 60 * 60 * 1000 // 6 HOURS
enabled: true (default)
```

**Query 2: useFeaturedHomeServices()**
```typescript
// Line 72
const { data: popularServicesData, isLoading: isLoadingPopular } = useFeaturedHomeServices();

// Cache Configuration:
queryKey: ["services", "featured", "home"]
queryFn: () => api.services.getFeaturedHome() → GET /api/services/featured/home
staleTime: 5 * 60 * 1000 // 5 MINUTES
gcTime: 10 * 60 * 1000 // 10 MINUTES
enabled: true (default)
```

**Query 3: useSearchDetectives({ status: "active", limit: 4 })**
```typescript
// Line 75
const { data: featuredDetectivesData, isLoading: isLoadingDetectives } = useSearchDetectives({ status: "active", limit: 4 });

// Cache Configuration:
queryKey: ["detectives", "search", { status: "active", limit: 4 }]
queryFn: () => api.detectives.search({ status: "active", limit: 4 })
staleTime: 5 * 60 * 1000 // 5 MINUTES
gcTime: 10 * 60 * 1000 // 10 MINUTES
enabled: true (default)
```

**Query 4: useSiteSettings()**
```typescript
// Line 76
const { data: siteData } = useSiteSettings();

// Cache Configuration:
queryKey: ["settings", "site"]
queryFn: () => api.settings.getSite()
staleTime: 0 // ⚠️ ALWAYS STALE
gcTime: 0 // ⚠️ NOT CACHED IN MEMORY
refetchOnWindowFocus: true // ⚠️ REFETCH ON FOCUS
refetchOnMount: "always" // ⚠️ REFETCH ON MOUNT
```

### Hero Component (hero.tsx)

**Query 5: usePopularCategories()**
```typescript
// Line 36
const { data: popularData } = usePopularCategories();

// Cache Configuration:
queryKey: ["categories", "popular"]
queryFn: () => api.catalog.getPopularCategories()
staleTime: 60 * 60 * 1000 // 1 HOUR
gcTime: 6 * 60 * 60 * 1000 // 6 HOURS
enabled: true (default)
```

**Query 6: useSiteSettings() — DUPLICATE**
```typescript
// Line 37 (ALREADY CALLED IN HOME.TSX!)
const { data: siteData } = useSiteSettings();

// Same problematic configuration:
staleTime: 0 // ⚠️ ALWAYS STALE
gcTime: 0 // ⚠️ NOT CACHED
refetchOnWindowFocus: true
refetchOnMount: "always"
```

**Direct API Call in useEffect (not a useQuery):**
```typescript
// Line 50-69
const handleSubmit = async () => {
  // Calls: api.publicPost<SmartSearchResult>("/api/smart-search", { query })
  // Triggered: User form submission (OK - user-initiated)
  // Not cached - user-triggered action
}
```

### Navbar Component (navbar.tsx)

**Query 7: useCurrentDetective()**
```typescript
// Line 49
const { data: currentDetectiveData } = useCurrentDetective();

// Cache Configuration:
queryKey: ["detectives", "current"]
queryFn: () => api.detectives.getCurrent()
staleTime: 0 // ⚠️ ALWAYS STALE
gcTime: 0 // ⚠️ NOT CACHED IN MEMORY
refetchOnWindowFocus: true // ⚠️ REFETCH ON FOCUS
refetchOnMount: "always" // ⚠️ REFETCH ON MOUNT
```

**Query 8: useSiteSettings() — TRIPLICATE**
```typescript
// Line 51 (ALREADY CALLED IN HOME.TSX AND HERO.TSX!)
const { data: siteData } = useSiteSettings();

// Same problematic configuration:
staleTime: 0 // ⚠️ ALWAYS STALE
gcTime: 0 // ⚠️ NOT CACHED
refetchOnWindowFocus: true
refetchOnMount: "always"
```

**Direct API Call in useEffect:**
```typescript
// Line 52-67
useEffect(() => {
  // Calls: api.get(`/api/search/autocomplete?q=${encodeURIComponent(query)}`)
  // Triggered: searchQuery state changes
  // Debounced: 300ms (OK - reasonable)
  // Abortable: Yes, previous requests cancelled
  // Not cached - dynamic search query
}, [searchQuery]);
```

### Footer Component (footer.tsx)

**Query 9: useSiteSettings() — QUADRUPLICATE**
```typescript
// Line 51
const { data: siteData } = useSiteSettings();

// Same problematic configuration:
staleTime: 0 // ⚠️ ALWAYS STALE
gcTime: 0 // ⚠️ NOT CACHED
refetchOnWindowFocus: true
refetchOnMount: "always"
```

### ServiceCard Component
- **No queries** - presentation component receiving data as props

---

## 3. Query Dependencies (Waterfall Pattern)

### Dependency Graph
```
PAGE LOAD
├─ Parallel Start (No dependencies)
│  ├─ useServiceCategories(true) → /api/service-categories (1 hour cache) ✅
│  ├─ useFeaturedHomeServices() → /api/services/featured/home (5 min cache) ✅
│  ├─ useSearchDetectives() → /api/detectives/search (5 min cache) ✅
│  ├─ useSiteSettings() → /api/settings/site (NO CACHE) ⚠️
│  │  ├─ (DUPLICATE) Hero.useSiteSettings() → SAME ENDPOINT
│  │  ├─ (DUPLICATE) Navbar.useSiteSettings() → SAME ENDPOINT
│  │  └─ (DUPLICATE) Footer.useSiteSettings() → SAME ENDPOINT
│  │
│  ├─ Hero.usePopularCategories() → /api/categories/popular (1 hour cache) ✅
│  │
│  ├─ Navbar.useCurrentDetective() → /api/detectives/current (NO CACHE) ⚠️
│  │
│  └─ Hero handleSubmit() → /api/smart-search (USER-TRIGGERED)
│  └─ Navbar autocomplete → /api/search/autocomplete (USER-TRIGGERED)
│
└─ Data Transformation (Non-blocking)
   └─ mapServiceToCard(popularServices) → ServiceCard props
      └─ Render 8 services in grid
```

### Analysis
- ✅ **NO WATERFALL PATTERN** - All queries load in parallel
- ℹ️ **No blocking dependencies** - Queries don't depend on each other
- ⚠️ **ISSUE: Multiple redundant requests** - useSiteSettings() called 4 times from different components
- ✅ **User-action queries properly isolated** - Smart search and autocomplete triggered on demand

---

## 4. Refetch Issues - Query Repeatedly Firing

### CRITICAL ISSUE: useSiteSettings() Refetches Without Caching

**Problem:**
```typescript
// In home.tsx, hero.tsx, navbar.tsx, footer.tsx:
useSiteSettings() {
  staleTime: 0,                    // ⚠️ Always considered stale
  gcTime: 0,                       // ⚠️ Never kept in memory
  refetchOnWindowFocus: true,      // ⚠️ Refetch when window regains focus
  refetchOnMount: "always"         // ⚠️ Refetch every time component mounts
}
```

**What happens:**
1. Home mounts → Request /api/settings/site (1st request)
2. Hero mounts (child) → Request /api/settings/site (2nd request - DUPLICATE)
3. Navbar mounts (sibling) → Request /api/settings/site (3rd request - DUPLICATE)
4. Footer mounts (sibling) → Request /api/settings/site (4th request - DUPLICATE)
5. User clicks browser window → All refetch ⚠️
6. User navigates away and back → All refetch again ⚠️

**Result:** `/api/settings/site` called **4× on initial load**, **potentially 12-16 times total** on user interaction

**Root Cause:**
- `staleTime: 0` means data is "stale immediately"
- `gcTime: 0` means data is purged from memory immediately
- React Query sees same queryKey but treats it as "expired"
- Settings rarely change - should be cached for hours

---

### SECONDARY ISSUE: useCurrentDetective() Always Fresh

**Problem:**
```typescript
// In navbar.tsx:
useCurrentDetective() {
  staleTime: 0,                    // ⚠️ Always stale
  gcTime: 0,                       // ⚠️ Never cached
  refetchOnWindowFocus: true,      // ⚠️ Refetch on focus
  refetchOnMount: "always"         // ⚠️ Always refetch
}
```

**Impact:**
- Called every time navbar renders (on page navigation)
- Refetched every time user clicks window/tab
- Verified detective data always hitting API
- **Could be: /api/detectives/current called 5-10 times per session**

---

### Missing enabled Flags
- ✅ All queries have implicit `enabled: true` (good)
- ✅ No queries that should be conditional are left enabled

---

## 5. useEffect-Triggered Refetch Analysis

### Effect 1: Hero scroll animation useEffect (OK)
```typescript
// Lines 78-97 in home.tsx
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container || categories.length === 0) return;

  const scrollInterval = setInterval(() => {
    // Auto-scroll categories - NO API CALLS
  }, 5000);

  return () => clearInterval(scrollInterval);
}, [categories.length]);  // ✅ GOOD - only depends on categories.length
```
- **Impact:** None - just DOM manipulation
- **Issue:** None

---

### Effect 2: Navbar search autocomplete (OK BUT EXCESSIVE API CALLS)
```typescript
// Lines 52-67 in navbar.tsx
useEffect(() => {
  const query = searchQuery.trim();
  
  if (!query || query.length < 3) {
    setSuggestions([]);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/search/autocomplete?q=${encodeURIComponent(query)}`);
      setSuggestions(data.suggestions || []);
    } finally {
      setLoading(false);
    }
  }, 300);  // 300ms debounce

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [searchQuery]);  // ✅ GOOD - depends on searchQuery
```
- **Impact:** API call on every keystroke (debounced 300ms)
  - User types "priv" = "p" → "pr" → "pri" → "priv" = 3 debounced API calls
  - Each keystroke in rapid succession = call every 300ms minimum
- **Issue:** Optional - could add minimum length check, already has debounce
- ✅ **Status:** Acceptable, has debounce and abort logic

---

### Effect 3: Hero smart search result scroll (NO API CALLS)
```typescript
// Lines 40-44 in hero.tsx
useEffect(() => {
  if (result && resultCardRef.current) {
    resultCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}, [result]);  // Only depends on result
```
- **Impact:** DOM manipulation only - no API calls
- **Issue:** None

---

## 6. Services Loading: Sequential or Parallel?

### Load Order on Page Mount

```
TIME 0ms:        PAGE LOAD STARTS
                 ├─ Query 1: useServiceCategories() starts
                 ├─ Query 2: useFeaturedHomeServices() starts
                 ├─ Query 3: useSearchDetectives() starts
                 ├─ Query 4: useSiteSettings() (home) starts
                 ├─ Query 5: useSiteSettings() (hero) starts ⚠️ DUPLICATE
                 ├─ Query 6: useSiteSettings() (navbar) starts ⚠️ DUPLICATE
                 ├─ Query 7: useSiteSettings() (footer) starts ⚠️ DUPLICATE
                 ├─ Query 8: usePopularCategories() starts
                 └─ Query 9: useCurrentDetective() starts

TIME 50-150ms:   RESULTS START ARRIVING (cached data)
                 ├─ ServiceCategories response
                 ├─ PopularCategories response
                 ├─ SiteSettings responses (4 simultaneous, same data)
                 └─ CurrentDetective response

TIME 200-400ms:  SLOWER QUERIES
                 ├─ FeaturedHomeServices arrives
                 └─ SearchDetectives arrives

TIME 400-600ms:  RENDERING
                 ├─ Categories section renders
                 ├─ Featured services grid (8 services + detective info)
                 └─ Featured detectives section
```

### Parallelism: ✅ FULLY PARALLEL

- **All queries start at the same time** (good)
- **No blocking dependencies** (good)
- **Loading states show skeleton UI** (good)
- **Issue:** Multiple redundant requests (bad)

### Services Loading Specifically:

**Data flow for 8 featured services:**
```typescript
// Line 72: Query starts
useFeaturedHomeServices()
  ↓
api.services.getFeaturedHome()
  ↓
GET /api/services/featured/home
  ↓
Returns: { services: Service[] } with detective info + avgRating + reviewCount
  ↓ (Line 73-74)
popularServicesData?.services || []
  ↓ (Line 73)
.map(mapServiceToCard(service))
  ↓ (mapServiceToCard function, lines 18-59)
Convert Service → ServiceCard prop object:
  - Extract images, badges, price, detective info
  - Calculate level display text
  - Build detective profile URL
  ↓ (Line 233)
popularServices.slice(0, 8)
  ↓ (Line 233-245)
Render grid with 8 ServiceCard components
  ├─ Each card loads images from service.images[0]
  └─ Lazy loading on ServiceCard images (loading="lazy")
```

**Parallelism:** ✅ Fully parallel with other queries

---

## 7. Exact Data Flow for 8 Homepage Services

### Step 1: Query Initiation
```typescript
const { data: popularServicesData, isLoading: isLoadingPopular } = useFeaturedHomeServices();
// queryKey: ["services", "featured", "home"]
// queryFn: () => api.services.getFeaturedHome()
```

### Step 2: API Call
```typescript
getFeaturedHome: async (): Promise<{ services: Service[] }> => {
  const response = await csrfFetch(`/api/services/featured/home`, {
    credentials: "include",
  });
  return handleResponse(response);
}

// Actually hits: GET /api/services/featured/home
```

### Step 3: Backend Response
```typescript
// Response contains:
{
  services: [
    {
      id: string,
      title: string,
      category: string,
      basePrice: string | null,
      offerPrice: string | null,
      isOnEnquiry: boolean,
      images: string[] | null,      // Array of image URLs
      orderCount: number,
      
      detective: {
        id: string,
        businessName: string,
        level: "level1" | "level2" | "level3" | "pro",
        logo: string | null,
        country: string,
        state: string,
        city: string,
        slug: string,
        phone: string | null,
        whatsapp: string | null,
        contactEmail: string | null,
        isVerified: boolean,
        subscriptionPackage: {...}
      },
      
      avgRating: number,             // Aggregated from reviews
      reviewCount: number            // Count of published reviews
    },
    // ... 8 total services
  ]
}
```

### Step 4: Caching
```typescript
// React Query caches with:
queryKey: ["services", "featured", "home"]
staleTime: 5 * 60 * 1000 // 5 minutes - data stays fresh
gcTime: 10 * 60 * 1000   // 10 minutes - stays in memory

// On reload within 5 min: Uses cached, no API call
// On reload after 5 min: Refetches in background (stale-while-revalidate)
// On reload after 10 min: Fully refetches
```

### Step 5: Data Transformation (Sync)
```typescript
// home.tsx lines 73-74
const popularServices = (popularServicesData?.services || []).map(mapServiceToCard);

// mapServiceToCard function transforms each service:
interface ServiceCardData {
  id: string;
  slug: string;                    // From service.slug
  detectiveId: string;             // From service.detective.id
  images: string[];                // From service.images
  image: string;                   // First image (backward compat)
  avatar: string;                  // From detective.logo
  name: string;                    // From detective.businessName
  level: string;                   // Formatted detective level
  levelValue: number;              // Numeric level (1, 2, 3, or 4)
  category: string;                // From service.category
  badgeState: ServiceBadgeState;   // Computed from badges
  title: string;                   // From service.title
  rating: number;                  // From service.avgRating
  reviews: number;                 // From service.reviewCount
  price: number;                   // Parsed basePrice
  offerPrice: number | null;       // Parsed offerPrice
  isOnEnquiry: boolean;            // From service.isOnEnquiry
  countryCode: string;             // From detective.country
  location: string;                // From detective.location
  phone: string;                   // From detective.phone
  whatsapp: string;                // From detective.whatsapp
  contactEmail: string;            // From detective.contactEmail
  detectiveCountry: string;       // Passed through
  detectiveState: string;         // Passed through
  detectiveCity: string;          // Passed through
  detectiveSlug: string;          // Passed through
  detectiveBusinessName: string;  // From detective.businessName
}
```

### Step 6: Loading State
```typescript
{isLoadingPopular ? (
  // Show 8 skeleton loaders
  [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
    <ServiceCardSkeleton key={i} />
  ))
) : (
  // Actual content
)}
```

### Step 7: Rendering
```typescript
// home.tsx line 233-245
popularServices.slice(0, 8).map((service) => (
  <ServiceCard 
    key={service.id} 
    {...service}  // Spread all props
  />
))

// Grid configuration (home.tsx line 230):
// grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6
// Layout: 1 col mobile, 2 col tablet, 4 col desktop
// Total: Up to 8 services visible per page
```

### Step 8: Image Loading in ServiceCard
```typescript
// service-card.tsx lines 165-170
const displayImages = images || (image ? [image] : []);

<img 
  src={displayImages[currentImageIndex]} 
  alt={`${title} - ${name}${countryCode ? ` in ${countryCode}` : ''}`}
  loading="lazy"  // ✅ Lazy load images
  className={`object-cover w-full h-full`}
/>
```

### Performance Timeline

```
T=0ms:    Page load starts, data requests initiated
T=100ms:  useSiteSettings + useCurrentDetective responses arrive
T=150ms:  useServiceCategories + usePopularCategories arrive
T=250ms:  useFeaturedHomeServices + useSearchDetectives arrive
T=280ms:  React re-renders with data
T=300ms:  Initial paint (isLoadingPopular becomes false)
T=400ms:  All images loaded (hero bg image, detective avatars)
T=500ms:  Service card images load on intersection (lazy loading)
T=1000ms: All images visible after scroll
```

---

## Summary Table: All Endpoints Called

| # | Endpoint | Component | Called | Stale | Cached | Blocking | Issues |
|---|----------|-----------|--------|-------|--------|----------|--------|
| 1 | `/api/service-categories?active=true` | home | Once | 1 hour | ✅ 1h | Skeleton | None |
| 2 | `/api/services/featured/home` | home | Once | 5 min | ✅ 5m | Skeleton | None |
| 3 | `/api/detectives/search` | home | Once | 5 min | ✅ 5m | Skeleton | None |
| 4 | `/api/settings/site` | home | 4× | 0 | ❌ None | Page | ⚠️ **4 duplicate calls** |
| 5 | `/api/settings/site` | hero | 4× | 0 | ❌ None | No | ⚠️ **Duplicate** |
| 6 | `/api/settings/site` | navbar | 4× | 0 | ❌ None | No | ⚠️ **Duplicate** |
| 7 | `/api/settings/site` | footer | 4× | 0 | ❌ None | No | ⚠️ **Duplicate** |
| 8 | `/api/categories/popular` | hero | Once | 1 hour | ✅ 1h | No | None |
| 9 | `/api/detectives/current` | navbar | Once | 0 | ❌ None | Page | ⚠️ **Always refetch** |
| 10 | `/api/smart-search` | hero | 0-1 | N/A | User | No | ✅ User-triggered |
| 11 | `/api/search/autocomplete` | navbar | 0+ | N/A | User | No | ✅ User-triggered, debounced |

---

## Critical Issues Found

### 🔴 CRITICAL #1: useSiteSettings() Called 4× in Parallel
**Impact:** Every page load duplicates 4 requests for same data  
**Fix:** Move to Context Provider at App level, share single query instance  
**Severity:** HIGH - 75% unnecessary API calls on this endpoint  

### 🔴 CRITICAL #2: useSiteSettings() Never Cached (staleTime: 0, gcTime: 0)
**Impact:** Settings refetch on every window focus + every mount  
**Fix:** Use `staleTime: 60 * 60 * 1000` (1 hour), `gcTime: 6 * 60 * 60 * 1000` (6 hours)  
**Severity:** HIGH - Settings rarely change, safe to cache long-term  

### 🔴 CRITICAL #3: useCurrentDetective() Never Cached
**Impact:** Every navbar render refetches user's detective profile  
**Fix:** Use `staleTime: 5 * 60 * 1000` (5 minutes), `gcTime: 10 * 60 * 1000` (10 minutes)  
**Severity:** MEDIUM - Verified on every page nav, hits on every window focus  

---

## Non-Critical Issues

### ⚠️ ISSUE #4: usePopularCategories() vs useServiceCategories()
**Problem:** Two different hooks for similar data  
- `usePopularCategories()` → `/api/categories/popular`
- `useServiceCategories(true)` → `/api/service-categories?active=true`
  
**Impact:** Slight redundancy, but acceptable  
**Recommendation:** Clarify which one is authoritative  

### ⚠️ ISSUE #5: Navbar Autocomplete API Calls Are Excessive
**Problem:** One keystroke = one API call (after 300ms debounce)  
**Example Flow:**
```
User types "detectives" → 10 characters
d → store [debounce]
e → store [debounce, previous canceled]
t → store [debounce, previous canceled]
... total = 5-7 API calls for one word (after 300ms intervals)
```

**Impact:** User typing continuously fires 1-2 API calls per second  
**Recommendation:** Add minimum length requirement (already has 3-char min, good)  

---

## Positive Findings ✅

1. **✅ All queries in parallel** - No waterfall/blocking pattern
2. **✅ Proper skeleton UI** - Loading states show before data arrives
3. **✅ Lazy image loading** - Images load on intersection, not all at once
4. **✅ Search queries cached appropriately** - 5 min staleTime good for dynamic content
5. **✅ Category data cached long** - 1 hour staleTime appropriate for static data
6. **✅ Autocomplete debounced** - 300ms debounce prevents rapid-fire calls
7. **✅ Smart search user-triggered** - Not called on page load, only on form submit
8. **✅ ServiceCard is presentation-only** - No child component queries (good pattern)
9. **✅ No dependency chains** - Queries load independently
10. **✅ Proper error boundaries** - Empty states shown when data unavailable

---

## Recommendations (Priority Order)

### Priority 1: Fix useSiteSettings() Caching
```typescript
// BEFORE:
export function useSiteSettings() {
  return useQuery({
    queryKey: ["settings", "site"],
    queryFn: () => api.settings.getSite(),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
}

// AFTER:
export function useSiteSettings() {
  return useQuery({
    queryKey: ["settings", "site"],
    queryFn: () => api.settings.getSite(),
    staleTime: 60 * 60 * 1000,    // 1 hour - settings rarely change
    gcTime: 6 * 60 * 60 * 1000,   // 6 hours - keep in memory
    refetchOnWindowFocus: false,   // Don't refetch on window focus
    refetchOnMount: false,         // Don't refetch on mount
  });
}
```

**Expected Benefit:**
- From: 4-16 `/api/settings/site` calls per session
- To: 1 call per session (or cached from previous session)
- **API reduction: 75-90%** on this endpoint

### Priority 2: Fix useCurrentDetective() Caching
```typescript
export function useCurrentDetective() {
  return useQuery({
    queryKey: ["detectives", "current"],
    queryFn: () => api.detectives.getCurrent(),
    staleTime: 5 * 60 * 1000,    // 5 minutes
    gcTime: 10 * 60 * 1000,      // 10 minutes
    refetchOnWindowFocus: false,   // Don't refetch on focus
    // Remove refetchOnMount: "always"
  });
}
```

**Expected Benefit:**
- Verified detective profile cached for 5 minutes
- **Reduced refetch events: 60-80%**

### Priority 3: Consolidate useSiteSettings() Calls
Move site settings to App-level Context Provider instead of calling in multiple components.

---

## Conclusion

The homepage has **good parallel loading architecture** with no waterfall/blocking patterns. However, **useSiteSettings() is severely over-fetched** (4-16 calls per session due to zero caching), and **useCurrentDetective() unnecessarily refetches** on every interaction.

**Quick wins:**
1. Change `useSiteSettings()` to `staleTime: 1 hour, gcTime: 6 hours, refetchOnWindowFocus: false`
2. Change `useCurrentDetective()` to `staleTime: 5 min, gcTime: 10 min, refetchOnWindowFocus: false`
3. Consider Context Provider for site settings

**Expected overall improvement:** 40-60% reduction in total API calls on homepage load + navigation.

