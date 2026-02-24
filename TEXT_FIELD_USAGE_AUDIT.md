# TEXT FIELD USAGE AUDIT REPORT
## Search for `detectives.country`, `detectives.state`, `detectives.city`

**Date:** February 24, 2026  
**Status:** READ-ONLY AUDIT - NO MODIFICATIONS  
**Scope:** Active code using text-based location filtering

---

## 📊 SUMMARY

| Field | Files Using | Total Occurrences | Active Code? |
|-------|-------------|------------------|--------------|
| `detectives.country` | 6 | 11 | ✅ YES |
| `detectives.state` | 2 | 2 | ✅ YES |
| `detectives.city` | 2 | 2 | ✅ YES |

---

## 🔴 ACTIVE CODE USING TEXT FIELDS

### 1. Featured Services Endpoint - Featured Home Services

**File:** [server/routes/featured-home-services.ts](server/routes/featured-home-services.ts#L50-L85)  
**Lines:** 50-85

**Context:** Featured services for country (with FK/text fallback)

```typescript
// Line 64: CONDITIONAL - Uses text fallback if FK not available
const countryFilter = country 
  ? (countryId ? 'AND d.country_id = $1' : 'AND d.country = $1')
  : '';
```

**Query Type:** SQL template (conditional)

**WHERE Clause:**
```sql
-- If FK available:
AND d.country_id = $1

-- FALLBACK if FK not found:
AND d.country = $1
```

**Filter Chain:**
- Line 50-58: Tries to resolve country to `country_id` via countries table
- Line 60-63: Falls back to text comparison on `d.country` if FK resolution fails
- Line 65-82: Uses conditional filter in SQL query

**Status:** ⚠️ **ACTIVE FALLBACK** - Queries `d.country` text field when FK not found

---

### 2. Services by Category & Location Query

**File:** [server/routes.ts](server/routes.ts#L3070-L3100)  
**Lines:** 3078

**Context:** Get services with text-based location filtering

```sql
WHERE d.country = $1
  AND s.is_active = true
ORDER BY s.view_count DESC
LIMIT 8;
```

**Query Type:** Raw SQL (raw pool query)

**WHERE Clause:** `d.country = $1` (direct text match)

**Filter Chain:**
- Filters services by `detectives.country` text field
- Uses parameter binding: `$1` = country value

**Status:** ✅ **ACTIVE CODE** - Uses text field directly

---

### 3. Detective Snippets Count Helper

**File:** [server/routes.ts](server/routes.ts#L7920-L7950)  
**Lines:** 7925-7930

**Context:** Count detectives for location + category (caching helper)

```typescript
const whereConditions = [
  eq(detectives.status, "active"),
  eq(detectives.country, String(country)),
  eq(services.category, String(category)),
];
if (state) whereConditions.push(eq(detectives.state, String(state)));
if (city) whereConditions.push(eq(detectives.city, String(city)));
```

**Query Type:** Drizzle ORM query builder

**WHERE Clause:**
- Line 7926: `eq(detectives.country, String(country))` ← Text field filter
- Line 7929: `eq(detectives.state, String(state))` ← Text field filter (conditional)
- Line 7930: `eq(detectives.city, String(city))` ← Text field filter (conditional)

**Filter Chain:**
- Used in caching logic for detective counts
- Called from: `countDetectivesForLocationCategory()` function
- Used to validate if snippets can be created

**Status:** ✅ **ACTIVE CODE** - Uses text fields for location filtering

---

### 4. Services by Category Search Endpoint

**File:** [server/routes.ts](server/routes.ts#L8170-L8210)  
**Lines:** 8186

**Context:** Search services by category, country, state, city

```sql
WHERE s.is_active = true AND d.country = $1 AND s.category = $2${stateClause}${cityClause}
```

**Query Type:** Raw SQL (raw pool query)

**WHERE Clause:** 
```sql
d.country = $1          -- Text field, parameter 1
d.state = $X            -- Text field (if stateClause exists)
d.city = $Y             -- Text field (if cityClause exists)
```

**Filter Chain:**
- Line 8180-8185: Build dynamic WHERE clauses
  ```typescript
  const stateClause = state ? ` AND d.state = $${paramIdx++}` : '';
  const cityClause = city ? ` AND d.city = $${paramIdx++}` : '';
  ```
- Line 8186: Uses `d.country`, `d.state`, `d.city` text fields directly
- Parameters bound dynamically

**Status:** ✅ **ACTIVE CODE** - Uses all three text fields in WHERE clause

---

## 🟡 DEBUG/SCRIPT FILES (Not Active Code)

These are helper scripts or debug files - NOT used in production:

### Debug Files Using Text Fields:

1. **check-country-data.ts**  
   Line 8: `eq(detectives.country, 'IN')`  
   Status: Debug script only

2. **fix-countries-code.ts**  
   Line 72: `LEFT JOIN detectives d ON d.country = c.code`  
   Status: Migration helper

3. **populate-countries.ts**  
   Line 50: `LEFT JOIN detectives d ON d.country = c.code`  
   Status: Data population script

4. **debug-sitemap-issue.ts**  
   Line 62: `LEFT JOIN detectives d ON d.country = c.iso_code`  
   Status: Debug script

5. **debug-sitemap.cjs**  
   Lines 63, 80: `LEFT JOIN detectives d ON d.country = c.*`  
   Status: Debug script

---

## 📋 DOCUMENTATION REFERENCES

These are documentation files that reference the pattern:

- BACKEND_SEARCH_ROUTE_ANALYSIS.md
- LOCATION_FILTERING_AUDIT_REPORT.md
- PAGINATION_FIX_FINAL_IMPLEMENTATION.md
- PAGINATION_FIX_IMPLEMENTATION.md

---

## ✅ FINDINGS

### Active Code Using Text Field Location Filters (4 endpoints):

| Endpoint | File | Lines | Fields Used | Impact |
|----------|------|-------|------------|--------|
| Featured Services | featured-home-services.ts | 64 | `country` (fallback) | Affects /api/detective/home |
| Services by Category | routes.ts | 3078 | `country` | Affects older search |
| Detective Snippets Count | routes.ts | 7925-7930 | `country`, `state`, `city` | Affects /api/snippets validation |
| Services Search | routes.ts | 8186 | `country`, `state`, `city` | Affects /api/services/search |

### Text Fields Used:
- ✅ `detectives.country` - 4 active code locations
- ✅ `detectives.state` - 2 active code locations  
- ✅ `detectives.city` - 2 active code locations

### Risk Assessment:

**HIGH RISK - Text field queries will break if:**
- Detectives have `country_id` but `country` text field is NULL
- Detectives have `state_id` but `state` text field is NULL
- Detectives have `city_id` but `city` text field is NULL

**Currently Using Hybrid Approach:**
- Line 64 (featured-home-services.ts): Has fallback logic ✅
- Line 3078 (routes.ts): Direct text query ⚠️
- Lines 7925-7930 (routes.ts): Direct text query ⚠️
- Line 8186 (routes.ts): Direct text query ⚠️

---

## 🎯 CONCLUSION

**Active code is still reliant on text-based location fields** (`country`, `state`, `city`).

**These fields MUST remain populated** or the following will fail:
- Featured services display
- Service search filtering
- Detective snippets validation
- Category-based service search

**Recommendation for Future Migration:**
Replace text field queries with FK-based queries in:
1. Line 3078 - featured services
2. Lines 7925-7930 - snippets count
3. Line 8186 - services search

But only AFTER ensuring `country_id`, `state_id`, `city_id` are populated for all detectives.

---

## 📝 AUDIT COMPLETE

**No code modified**  
**No suggestions implemented**  
**Report generated for review only**
