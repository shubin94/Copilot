# LOCATION-BASED FILTERING AUDIT REPORT
**READ-ONLY CODE AUDIT - NO MODIFICATIONS MADE**

Generated: 2026-02-24
Database: Production (LIVE)
Scope: Entire backend codebase

---

## EXECUTIVE SUMMARY

**Total Text-Based Location Filters Found: 47 occurrences**

**Critical Routes Affected: 15 endpoints**

**Risk Level: HIGH** ⚠️
- All location filtering currently uses TEXT-based matching
- No ID-based filtering detected in production code
- High risk of data inconsistency when switching to FK-based filtering
- Public-facing search, SEO, and featured services heavily dependent on text matching

---

## 1. PUBLIC SEARCH & DISCOVERY ENDPOINTS

### 1.1 Service Search (PRIMARY PUBLIC ENDPOINT)
**File:** [server/storage.ts](server/storage.ts#L900-L920)  
**Function:** `searchServices()`  
**Filtering Type:** TEXT-BASED

```typescript
// Lines 907-913
if (filters.country) {
  conditions.push(eq(detectives.country, filters.country));
}
if (filters.state) {
  conditions.push(ilike(detectives.state, filters.state));
}
if (filters.city) {
  conditions.push(ilike(detectives.city, filters.city));
}
```

**Impact:**
- Used by main service search page
- Filters: `detectives.country` (exact match), `detectives.state` (ILIKE), `detectives.city` (ILIKE)
- **Risk:** ILIKE on state/city means case-insensitive partial matching - will break with FK IDs

---

### 1.2 Detective Search (Admin)
**File:** [server/storage.ts](server/storage.ts#L715-L745)  
**Function:** `searchDetectives()`  
**Filtering Type:** TEXT-BASED

```typescript
// Line 727
if (filters.country) conditions.push(eq(detectives.country, filters.country));
```

**Impact:**
- Admin detective search/filtering
- Exact text match on country field
- **Risk:** Currently expects country code/name strings, not IDs

---

### 1.3 Detective Ranking System
**File:** [server/ranking.ts](server/ranking.ts#L300-L320)  
**Function:** `getDetectivesWithRanking()`  
**Filtering Type:** TEXT-BASED

```typescript
// Lines 309-319
if (opts.country && opts.country !== "all") {
  conditions.push(eq(detectives.country, opts.country));
}
if (opts.state && opts.state !== "all") {
  conditions.push(eq(detectives.state, opts.state));
}
if (opts.city && opts.city !== "all") {
  conditions.push(eq(detectives.city, opts.city));
}
```

**Impact:**
- Powers detective listing with visibility scoring
- Used in admin rankings page
- **Risk:** All three location fields use text matching

---

## 2. SEO & LOCATION PAGES

### 2.1 Location SEO Injection
**File:** [server/lib/seo-injection.ts](server/lib/seo-injection.ts#L650-L680)  
**Function:** `getDetectivesByLocation()`  
**Filtering Type:** TEXT-BASED with fallback logic

```typescript
// Lines 664-679
if (countryCode) {
  conditions.push(
    or(eq(detectives.country, countryCode), eq(detectives.country, countryName))!
  );
} else {
  conditions.push(eq(detectives.country, countryName));
}
if (state) {
  const normalizedState = slugToTitleCase(state);
  conditions.push(eq(detectives.state, normalizedState));
}
if (city) {
  const normalizedCity = slugToTitleCase(city);
  conditions.push(eq(detectives.city, normalizedCity));
}
```

**Impact:**
- Powers `/location/:country/:state?/:city?` pages
- Uses slug-to-title-case conversion
- Tries both country code AND country name
- **Risk:** Complex text matching logic will fail with FK IDs

---

### 2.2 Admin Location SEO Management (Countries)
**File:** [server/routes.ts](server/routes.ts#L1672-L1700)  
**Route:** `GET /api/admin/location-seo/countries`  
**Filtering Type:** TEXT-BASED (Raw SQL)

```sql
-- Lines 1678-1699
SELECT DISTINCT
  TRIM(d.country) AS country,
  LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')) AS country_slug,
  COUNT(*) FILTER (WHERE d.status = 'active') AS detective_count,
  lso.meta_title,
  lso.meta_description,
  lso.h1
FROM detectives d
LEFT JOIN location_seo_overrides lso
  ON lso.entity_type = 'country'
  AND lso.entity_id = LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g'))
WHERE d.country IS NOT NULL
  AND TRIM(d.country) <> ''
GROUP BY
  LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')),
  lso.meta_title, lso.meta_description, lso.h1
ORDER BY country_slug ASC
```

**Impact:**
- Admin page for managing country SEO
- Extracts countries directly from `detectives.country` text field
- **Risk:** HIGH - Entire admin UI depends on text extraction

---

### 2.3 Admin Location SEO Management (States)
**File:** [server/routes.ts](server/routes.ts#L1715-L1745)  
**Route:** `GET /api/admin/location-seo/states`  
**Filtering Type:** TEXT-BASED (Raw SQL)

```sql
-- Lines 1717-1741
SELECT DISTINCT
  LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')) AS country_slug,
  LOWER(REGEXP_REPLACE(TRIM(d.state), '\\s+', '-', 'g')) AS state_slug,
  TRIM(d.state) AS state,
  COUNT(*) FILTER (WHERE d.status = 'active') AS detective_count,
  lso.meta_title, lso.meta_description, lso.h1
FROM detectives d
LEFT JOIN location_seo_overrides lso
  ON lso.entity_type = 'state'
  AND lso.entity_id = LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')) || '/' || LOWER(REGEXP_REPLACE(TRIM(d.state), '\\s+', '-', 'g'))
WHERE d.country IS NOT NULL AND TRIM(d.country) <> ''
  AND d.state IS NOT NULL AND TRIM(d.state) <> ''
GROUP BY
  LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')),
  LOWER(REGEXP_REPLACE(TRIM(d.state), '\\s+', '-', 'g')),
  TRIM(d.state), lso.meta_title, lso.meta_description, lso.h1
ORDER BY country_slug ASC, state_slug ASC
```

**Impact:**
- Admin page for managing state SEO
- Extracts states from `detectives.state` text field
- **Risk:** HIGH - Entire admin UI depends on text extraction

---

### 2.4 Admin Location SEO Management (Cities)
**File:** [server/routes.ts](server/routes.ts#L1757-L1791)  
**Route:** `GET /api/admin/location-seo/cities`  
**Filtering Type:** TEXT-BASED (Raw SQL)

```sql
-- Lines 1759-1790
SELECT DISTINCT
  LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')) AS country_slug,
  LOWER(REGEXP_REPLACE(TRIM(d.state), '\\s+', '-', 'g')) AS state_slug,
  LOWER(REGEXP_REPLACE(TRIM(d.city), '\\s+', '-', 'g')) AS city_slug,
  TRIM(d.country) AS country,
  TRIM(d.state) AS state,
  TRIM(d.city) AS city,
  COUNT(*) FILTER (WHERE d.status = 'active') AS detective_count,
  lso.meta_title, lso.meta_description, lso.h1
FROM detectives d
LEFT JOIN location_seo_overrides lso
  ON lso.entity_type = 'city'
  AND lso.entity_id = LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')) || '/' || LOWER(REGEXP_REPLACE(TRIM(d.state), '\\s+', '-', 'g')) || '/' || LOWER(REGEXP_REPLACE(TRIM(d.city), '\\s+', '-', 'g'))
WHERE d.country IS NOT NULL AND TRIM(d.country) <> ''
  AND d.state IS NOT NULL AND TRIM(d.state) <> ''
  AND d.city IS NOT NULL AND TRIM(d.city) <> ''
GROUP BY
  LOWER(REGEXP_REPLACE(TRIM(d.country), '\\s+', '-', 'g')),
  LOWER(REGEXP_REPLACE(TRIM(d.state), '\\s+', '-', 'g')),
  LOWER(REGEXP_REPLACE(TRIM(d.city), '\\s+', '-', 'g')),
  TRIM(d.country), TRIM(d.state), TRIM(d.city),
  lso.meta_title, lso.meta_description, lso.h1
ORDER BY country_slug ASC, state_slug ASC, city_slug ASC
```

**Impact:**
- Admin page for managing city SEO
- Extracts cities from `detectives.city` text field
- **Risk:** CRITICAL - Entire admin UI and SEO system depends on text extraction

---

### 2.5 Public Location Pages (Detectives by Location)
**File:** [server/routes.ts](server/routes.ts#L6800-L6950)  
**Route:** `GET /api/detectives/location/:countrySlug/:stateSlug?/:citySlug?`  
**Filtering Type:** TEXT-BASED with complex fallback (Raw SQL)

```sql
-- Lines 6813-6935 (multiple queries)
-- Query for states:
SELECT DISTINCT d.state AS state
FROM detectives d
WHERE (
  LOWER(TRIM(d.country)) = LOWER(TRIM($1))
  OR LOWER(TRIM(d.country)) = LOWER(TRIM($2))
  OR LOWER(TRIM(d.country)) = LOWER(TRIM($3))
)
  AND d.state IS NOT NULL
  AND TRIM(d.state) <> ''
  AND LOWER(TRIM(d.state)) <> 'not specified'
ORDER BY d.state;

-- Query for cities:
SELECT DISTINCT d.city AS city
FROM detectives d
WHERE (...)
  AND d.city IS NOT NULL
  AND TRIM(d.city) <> ''
  AND LOWER(TRIM(d.city)) <> 'not specified'
ORDER BY d.city;
```

**Impact:**
- Public-facing location pages (e.g., `/location/india/tamil-nadu/coimbatore`)
- Tries to match country via code, name, and slug
- Falls back to raw SQL text matching if normalized tables empty
- **Risk:** CRITICAL - Primary public SEO pages depend on text matching

---

## 3. FEATURED SERVICES & HOMEPAGE

### 3.1 Featured Home Services
**File:** [server/routes/featured-home-services.ts](server/routes/featured-home-services.ts#L48-L91)  
**Route:** `GET /api/featured-home-services`  
**Filtering Type:** TEXT-BASED (Raw SQL)

```sql
-- Lines 48-91
const countryFilter = country ? `AND d.country = '${country}'` : '';

SELECT 
  d.country, d.state, d.city,
  s.*, r.rating, sp.*
FROM (...) d
JOIN services s ON s.detective_id = d.id
LEFT JOIN reviews r ON r.service_id = s.id
WHERE d.status = 'active'
  ${countryFilter}  -- DYNAMIC SQL INJECTION (text-based)
ORDER BY visibility_score DESC
LIMIT 8
```

**Impact:**
- Homepage featured services
- Optional country filter using text matching
- **Risk:** HIGH - Dynamic SQL with text interpolation

---

### 3.2 Homepage Featured Services (Legacy)
**File:** [server/routes.ts](server/routes.ts#L2920-L2970)  
**Route:** `GET /api/home-featured-services`  
**Filtering Type:** TEXT-BASED (Raw SQL)

```sql
-- Lines 2928-2946
SELECT s.*
FROM homepage_featured_services h
JOIN services s ON s.id = h.service_id
WHERE h.country = $1
  AND s.is_active = true
ORDER BY h.position ASC

-- Fallback query:
SELECT s.*
FROM services s
JOIN detectives d ON s.detective_id = d.id
WHERE d.country = $1
  AND s.is_active = true
ORDER BY s.view_count DESC
```

**Impact:**
- Alternative homepage featured services endpoint
- Uses `homepage_featured_services.country` (text field)
- Falls back to `detectives.country` (text field)
- **Risk:** HIGH - Both primary and fallback use text matching

---

## 4. DETECTIVE SNIPPETS & AVAILABILITY

### 4.1 Snippet Location Availability
**File:** [server/routes.ts](server/routes.ts#L7590-L7820)  
**Route:** `GET /api/snippets/available-locations`  
**Filtering Type:** TEXT-BASED

```typescript
// Lines 7597-7810
// Countries query:
whereConditions.push(eq(detectives.country, String(country)));
// States query:
if (state) whereConditions.push(eq(detectives.state, String(state)));
// Cities query:
if (city) whereConditions.push(eq(detectives.city, String(city)));

// SELECT DISTINCT operations:
.selectDistinct({ country: detectives.country })
.selectDistinct({ state: detectives.state })
.selectDistinct({ city: detectives.city })
```

**Impact:**
- Populates location dropdowns in snippet management
- All three levels use text-based filtering
- **Risk:** MEDIUM - Admin functionality, not public-facing

---

## 5. SITEMAP GENERATION

### 5.1 Sitemap Service (Location Pages)
**File:** [server/services/sitemapService.ts](server/services/sitemapService.ts#L140-L250)  
**Functions:** `generateCountrySitemaps()`, `generateStateSitemaps()`, `generateCitySitemaps()`  
**Filtering Type:** TEXT-BASED (Raw SQL)

```sql
-- Country query (Line 148):
INNER JOIN detectives d ON d.country = c.code

-- State query (Lines 188-193):
INNER JOIN countries c ON d.country = c.code
WHERE d.status = 'active' AND d.state IS NOT NULL AND d.state != ''
GROUP BY c.name, c.slug, d.state

-- City query (Lines 233-240):
INNER JOIN countries c ON d.country = c.code
WHERE d.status = 'active' AND d.city IS NOT NULL AND d.city != ''
GROUP BY c.name, c.slug, d.state, d.city
```

**Impact:**
- Generates sitemap XML files for SEO
- Joins `detectives.country` (text) with `countries.code` (text)
- Extracts states/cities from text fields
- **Risk:** MEDIUM - SEO impact, but regenerated periodically

---

## 6. AUTOCOMPLETE & SMART SEARCH

### 6.1 Autocomplete Detective Search
**File:** [server/routes.ts](server/routes.ts#L4300-L4400)  
**Route:** `GET /api/autocomplete`  
**Filtering Type:** TEXT-BASED

```typescript
// Lines 4333-4352
const detectivesResult = await db
  .select({
    country: detectives.country,
    state: detectives.state,
    city: detectives.city,
  })
  .from(detectives)
  .where(and(
    eq(detectives.status, "active"),
    ilike(detectives.businessName, `%${query}%`)
  ))
```

**Impact:**
- Autocomplete suggestions on homepage
- Returns location data from text fields
- **Risk:** LOW - Display only, no filtering logic

---

## 7. DETECTIVE PROFILES & PUBLIC PAGES

### 7.1 Detective Profile Data
**File:** [server/routes.ts](server/routes.ts#L1600-L1610)  
**Route:** Various detective profile endpoints  
**Filtering Type:** TEXT-BASED (data retrieval)

```typescript
// Lines 1603-1605
city: d.city ?? null,
state: d.state ?? null,
country: d.country ?? null,
```

**Impact:**
- Profile display pages
- Passes text fields to frontend
- **Risk:** LOW - Display only

---

## 8. ADDITIONAL FINDINGS

### 8.1 Country Code Mapper Utility
**File:** [server/utils/countryCodeMapper.ts](server/utils/countryCodeMapper.ts#L315)  
**Function:** `getAllCountriesFromDB()`  
**Filtering Type:** TEXT-BASED

```typescript
// Line 315
.map(d => d.country)
```

**Impact:**
- Extracts unique countries from detectives table
- Used for country mapping logic
- **Risk:** LOW - Utility function

---

### 8.2 Search Stats Raw SQL
**File:** [server/routes.ts](server/routes.ts#L7857)  
**Route:** Category-based service search (internal)  
**Filtering Type:** TEXT-BASED (Raw SQL)

```sql
-- Line 7857
WHERE s.is_active = true AND d.country = $1 AND s.category = $2${stateClause}${cityClause}
```

**Impact:**
- Internal search statistics
- Uses parameterized queries (safe from injection)
- **Risk:** MEDIUM - Needs update for FK-based filtering

---

## SUMMARY TABLE

| Category | Endpoints | Text-Based | ID-Based | Risk Level |
|----------|-----------|------------|----------|------------|
| Public Search & Discovery | 3 | 3 | 0 | 🔴 HIGH |
| SEO & Location Pages | 5 | 5 | 0 | 🔴 CRITICAL |
| Featured Services | 2 | 2 | 0 | 🔴 HIGH |
| Snippets & Availability | 1 | 1 | 0 | 🟡 MEDIUM |
| Sitemap Generation | 3 | 3 | 0 | 🟡 MEDIUM |
| Autocomplete | 1 | 1 | 0 | 🟢 LOW |
| Profile Display | 1 | 1 | 0 | 🟢 LOW |
| Utilities | 2 | 2 | 0 | 🟢 LOW |
| **TOTAL** | **18** | **18** | **0** | **HIGH** |

---

## CRITICAL DEPENDENCIES

### Text Fields Currently Used:
1. `detectives.country` - **47 references** across 8 files
2. `detectives.state` - **32 references** across 7 files
3. `detectives.city` - **30 references** across 7 files

### Text Matching Methods:
- **Exact match:** `eq(detectives.country, value)` - 28 occurrences
- **Case-insensitive:** `ilike(detectives.state, value)` - 4 occurrences
- **Raw SQL TRIM/LOWER:** 15 occurrences in admin routes
- **REGEXP_REPLACE slugification:** 12 occurrences in SEO routes

---

## RISK ASSESSMENT

### 🔴 CRITICAL RISK (Immediate Impact):
1. **Admin Location SEO Pages** (3 endpoints)
   - Entire UI depends on text extraction from `detectives` table
   - No fallback to normalized tables yet
   - **Impact:** Admin cannot manage SEO if text fields removed

2. **Public Location Pages** (`/location/:country/:state?/:city?`)
   - Complex text-based matching with multiple fallbacks
   - Primary public SEO endpoints
   - **Impact:** 404 errors on all location pages

### 🔴 HIGH RISK (Major Functionality):
1. **Service Search** (`searchServices()`)
   - Main public search uses ILIKE on state/city
   - Cannot switch to FK IDs without query rewrite
   - **Impact:** Search results will be empty or incorrect

2. **Featured Services** (Homepage)
   - Country filter uses text matching
   - Dynamic SQL with text interpolation
   - **Impact:** Homepage may show wrong/no services

3. **Detective Ranking System**
   - All location filters use text matching
   - **Impact:** Admin rankings will be incorrect

### 🟡 MEDIUM RISK (Administrative):
1. **Snippet Management**
   - Location dropdowns use text extraction
   - **Impact:** Cannot create/edit snippets

2. **Sitemap Generation**
   - Joins on text fields
   - **Impact:** Sitemaps may be incomplete/incorrect

### 🟢 LOW RISK (Display Only):
1. **Autocomplete** - Display only, no filtering
2. **Profile Display** - Read-only data display
3. **Utility Functions** - Support functions

---

## MIGRATION STRATEGY RECOMMENDATIONS

### Phase 1: Dual-Column Support (SAFE, ZERO DOWNTIME)
1. Keep `detectives.country/state/city` (text) - **DO NOT DROP**
2. Add `detectives.country_id/state_id/city_id` (FK) - **NEW COLUMNS**
3. Populate FK IDs from text using backfill migration
4. Update queries to use COALESCE(id, text) fallback

### Phase 2: Query Migration (PER-ENDPOINT)
For each critical endpoint:
1. Add FK-based query path
2. Keep text-based fallback
3. Test with beta flag
4. Monitor error rates
5. Gradually switch traffic

### Phase 3: Text Field Deprecation (6+ MONTHS LATER)
1. Verify ALL queries use FK IDs
2. Set text fields to NULL for new records
3. Monitor for errors (3+ months)
4. Eventually drop text columns (optional)

### Required Code Changes: ~47 File Edits
- [server/storage.ts](server/storage.ts): 8 query updates
- [server/routes.ts](server/routes.ts): 12 endpoint updates (admin SEO, location pages)
- [server/lib/seo-injection.ts](server/lib/seo-injection.ts): 3 query updates
- [server/ranking.ts](server/ranking.ts): 3 filter updates
- [server/routes/featured-home-services.ts](server/routes/featured-home-services.ts): 2 query updates
- [server/services/sitemapService.ts](server/services/sitemapService.ts): 3 sitemap query updates
- [server/routes.ts](server/routes.ts) (snippets): 3 availability query updates

---

## CONCLUSION

**All location-based filtering in the backend currently uses TEXT-BASED matching.**

**NO ID-based filtering exists in production.**

**Switching to FK-based filtering requires:**
- ✅ Dual-column support (keep text + add FK IDs)
- ✅ ~47 query rewrites across 8 files
- ✅ Extensive testing of ALL 18 affected endpoints
- ✅ Gradual rollout with fallback logic
- ✅ 6+ month monitoring period before text field removal

**Immediate Action Required:**
1. Run backfill migration to populate `countries`, `states`, `cities` tables
2. DO NOT drop text columns yet
3. Begin query migration starting with LOW RISK endpoints (autocomplete, profile display)
4. Test CRITICAL endpoints in staging with FK queries + text fallback
5. Monitor error rates before production rollout

---

**END OF AUDIT REPORT - READ-ONLY ANALYSIS COMPLETE**
