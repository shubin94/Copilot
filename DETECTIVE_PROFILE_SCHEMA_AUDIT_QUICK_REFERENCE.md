# DETECTIVE PROFILE SCHEMA AUDIT — QUICK REFERENCE

**Audit Date:** May 2026  
**Status:** ✅ COMPLETE (Audit Only)  
**Recommendation:** Proceed to Phase 2 with listed mitigations

---

## KEY FINDINGS AT A GLANCE

### ✅ What's Working Well

| Component | Status | Evidence |
|-----------|--------|----------|
| Review/Rating System | ✅ LIVE | AggregateRating emitted when reviewCount > 0 |
| Data Quality | ✅ CLEAN | No fake/placeholder schema values detected |
| Deduplication | ✅ SAFE | Meta marker prevents hydration issues |
| BreadcrumbList | ✅ SOLID | 4-5 level hierarchy working |
| Contact Info | ✅ PROPER | Email, phone, WhatsApp properly typed |
| Address Schema | ✅ CONDITIONAL | Only emitted when data exists |
| LocalBusiness | ✅ FUNCTIONAL | Multi-typed with ProfessionalService |

### ⚠️ What Needs Attention

| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| LocalBusiness duplic | MEDIUM | Phase 3 SSR + Client | Consolidate or accept |
| Person schema unused | LOW | Generated but not injected | Add to injectSeoTags |
| Payment methods hardcoded | MEDIUM | Line 1147 seo-injection.ts | Remove or per-detective |
| knowsAbout generic | MEDIUM | All verified = same expertise | Use service categories |
| No individual Review nodes | LOW | generateReviewSchema unused | Inject as array |
| Review schema not injected | LOW | Client structured-data.ts | Add to emit flow |

### ❌ Missing Features (Phase 2 Candidates)

| Field | Priority | DB Support | Impact |
|-------|----------|-----------|--------|
| hasCredential | HIGH | YES (licenseNumber) | Professional authority |
| memberOf | MEDIUM | YES (recognitions) | Org relationships |
| award | MEDIUM | YES (recognitions) | Recognition signals |
| geo | MEDIUM | NO (needs migration) | Geographic precision |
| priceRange | HIGH | YES (services) | Cost signals |
| contactPoint.areaServed | HIGH | PARTIAL | Service area |
| Review nodes | MEDIUM | YES (reviews table) | Rich snippets |
| Offer pricing | MEDIUM | YES (services) | Service pricing |

---

## SCHEMA INJECTION FLOW

```
DETECTIVE PROFILE PAGE REQUEST
↓
SSR PHASE (server/index-dev.ts or server/index-prod.ts)
├─ getDetectiveBySlugForSEO() → Fetch detective data
├─ injectSeoTags() → Generate and inject:
│  ├─ Title/Meta tags
│  ├─ H1 (hidden)
│  ├─ BreadcrumbList (Phase 1)
│  ├─ WebPage/ProfilePage schema (Phase 1)
│  ├─ Phase 3 LocalBusiness (conditional)
│  └─ window.__SEO_DATA__ seed
└─ Return HTML + injected schemas

CLIENT HYDRATION (client/src/pages/detective.tsx)
├─ Detect SSR seed
├─ Fetch detective data (if needed)
├─ generateCompleteDetectiveSchema():
│  ├─ BreadcrumbList
│  ├─ Client LocalBusiness (full)
│  ├─ AggregateRating (merged in)
│  ├─ Individual Service schemas
│  └─ SpeakableSpecification
└─ Render via SEO component

RESULT
├─ SEO data: BreadcrumbList + WebPage + Phase 3 LocalBusiness (SSR, seen first)
├─ Rendering: Client LocalBusiness + SpeakableSpecification (seen by crawler after rendering)
└─ Deduplication: Meta marker prevents React from re-injecting Phase 1 schemas
```

---

## FIELD IMPLEMENTATION STATUS

### ✅ Fully Implemented (15 fields)

```
businessName → name
bio → description
logo → image, logo (ImageObject)
phone → telephone, ContactPoint.telephone
contactEmail → email, ContactPoint.email
address → address.streetAddress
city → address.addressLocality, areaServed
state → address.addressRegion
country → address.addressCountry
licenseNumber → identifier (PropertyValue)
businessWebsite → sameAs
languages → ContactPoint.availableLanguage
isVerified → knowsAbout (conditional list)
yearsExperience → yearsInOperation
avgRating (derived) → AggregateRating.ratingValue
reviewCount (derived) → AggregateRating.reviewCount
```

### ⚠️ Partially Implemented (3 fields)

```
recognitions → NOT MAPPED (stored in DB, never emitted)
memberSince → PARTIAL (only in WebPage, not LocalBusiness)
socialLinks → PARTIAL (conditional on object structure)
```

### ❌ Not Implemented (12 fields)

```
foundingDate, hasCredential, memberOf, affiliation, alumniOf, award
knowsAbout (detailed), additionalType, geo, priceRange
ContactPoint.contactType, ContactPoint.areaServed (service area)
```

---

## SCHEMA TYPES MATRIX

| Type | SSR | Client | @id Fragment | Status |
|------|-----|--------|--------------|--------|
| BreadcrumbList | ✅ | ❌ | — | Active |
| LocalBusiness | ✅ (Phase 3) | ✅ | #localbusiness | DUPLICATE RISK |
| ProfessionalService | ✅ (merged) | ✅ (merged) | #localbusiness | OK |
| ProfilePage | ✅ | ❌ | #webpage | Active |
| AggregateRating | ✅ (conditional) | ❌ | (merged) | OK |
| Person | ✅ (generated, NOT injected) | ❌ | #person | UNUSED |
| SpeakableSpecification | ❌ | ✅ | — | Active |
| Service | ❌ | ✅ (generated, NOT injected) | #service-{id} | UNUSED |
| Review | ❌ | ❌ (generated, NOT injected) | — | UNUSED |

---

## DUPLICATION RISK ASSESSMENT

### LocalBusiness Duplication

**Scenario:**
1. SSR emits Phase 3 LocalBusiness (minimal, @id#localbusiness)
2. Client generates full LocalBusiness (complete, @id#localbusiness)
3. Two nodes, same @id, different data

**Risk Level:** ⚠️ **MODERATE** (but mitigated)

**Mitigation:**
- Deduplication marker: `<meta name="askdetectives:ssr-schema" content="authoritative">`
- React checks this before hydrating
- Prevents hard errors, but schema inconsistency could be logged

**Resolution Options:**
1. Use only client-side LocalBusiness (remove Phase 3)
2. Use only SSR LocalBusiness (enhance Phase 3)
3. Ensure Phase 3 = Client version (consolidate)
4. Accept current state (working but not optimal)

---

## DATA QUALITY CHECKS

### ✅ Passed Validations

- ✅ No fake schema values detected
- ✅ All URLs start with http/https
- ✅ License numbers only if provided
- ✅ Service categories only from actual services
- ✅ Ratings only from published reviews
- ✅ Null fields properly guarded (conditional emission)

### ⚠️ Potential Issues

- ⚠️ Payment methods hardcoded (affects all detectives)
- ⚠️ knowsAbout generic for all verified detectives
- ⚠️ Default fallback "Detective" as name acceptable but generic
- ⚠️ No field for international language verification

### ✅ Numeric Validation

```typescript
// AggregateRating validation (strict gates)
reviewCountInt > 0 ✓
Number.isInteger(reviewCountInt) ✓
ratingValue >= 1 && ratingValue <= 5 ✓
Number.isFinite(ratingValue) ✓
```

---

## FILES REQUIRING CHANGES (Phase 2)

### Core Schema Files
| File | Lines | Purpose |
|------|-------|---------|
| server/lib/seo-injection.ts | 1429 | SSR schema generation |
| client/src/lib/structured-data.ts | 550+ | Client schema generation |
| shared/schema.ts | — | DB table definitions |

### Conditional Changes
- `client/src/pages/detective.tsx` — Only if new data needs fetching
- `server/index-dev.ts` — Only if SSR data structure changes
- `server/index-prod.ts` — Only if SSR data structure changes

### No Changes Needed
- `client/src/pages/detective-page-helpers.ts` — Helper logic
- `shared/country-currency-map.ts` — Config
- Database tables — Already support most fields

---

## PHASE 2 EXPANSION ROADMAP

### Wave 1: Low-Risk, Quick Wins (No DB Changes)
1. **Inject Person Schema** (Line 1344 → injectSeoTags)
2. **Fix Payment Methods** (Line 1147 → Remove or per-detective)
3. **Emit Review Array** (Line 190 structured-data.ts → Inject)
4. **Improve knowsAbout** (Use service.category instead of generic)

### Wave 2: Medium-Risk, Medium-Effort (DB Support Exists)
1. **Add hasCredential** (Use licenseNumber, format as EducationalOccupationalCredential)
2. **Add memberOf** (Use recognitions.organization if exists)
3. **Add priceRange** (Derive from services min/max)
4. **Add Offer objects** (From services pricing)

### Wave 3: Requires Enhancement (DB Migration Needed)
1. **Add geo/GeoCoordinates** (Add lat/lng columns to detectives)
2. **Add memberOf structure** (Create professional-memberships table)
3. **Add contact area** (Specify ContactPoint.areaServed for each contact type)

---

## VALIDATION CHECKLIST (Post-Implementation)

### Automated Tests
- [ ] No duplicate @id nodes with different data
- [ ] All URLs are absolute + HTTPS
- [ ] No null/empty values in required fields
- [ ] Number values are not strings
- [ ] Language array is non-empty when present
- [ ] AggregateRating only when reviewCount > 0

### Manual Verification
- [ ] Run through Google Rich Results Tester
- [ ] Check schema.org validator
- [ ] Compare SSR vs client schema (should match)
- [ ] Test with detective profile (high-detail)
- [ ] Test with detective profile (low-detail)
- [ ] Test with detective profile (verified)
- [ ] Test with detective profile (unverified)
- [ ] Test with detective profile (no reviews)
- [ ] Test with detective profile (many reviews)

### Schema Consistency
- [ ] Person → worksFor → LocalBusiness matches
- [ ] BreadcrumbList last item = LocalBusiness name
- [ ] ContactPoint.email = email field
- [ ] ContactPoint.telephone = telephone field
- [ ] Address locality/region/country consistent
- [ ] SpeakableSpecification selectors match page markup

---

## QUICK COMMANDS

### View Current SSR Schema
```bash
# Fetch detective profile
curl "https://www.askdetectives.com/detectives/[country]/[state]/[city]/[slug]"

# Search for schema blocks
grep -o '<script type="application/ld+json">.*</script>' | head -5
```

### Check Client Schema Generation
```bash
# Open DevTools Console
JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)
```

### Validate Schema
- Google Rich Results: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/
- Structured Data Testing Tool: https://www.google.com/webmasters/tools/richsnippets

---

## DECISION MATRIX FOR PHASE 2

### Should we implement this field?

```
                 LOW EFFORT          HIGH EFFORT
HIGH VALUE   ✅ DO IT FIRST    ⚠️ CONSIDER
             (Person, Reviews) (hasCredential)

LOW VALUE    ❌ SKIP            ❌ SKIP
             (foundingDate)     (alumniOf)
```

**High Value = "Likely to improve search visibility or user trust"**  
**Low Effort = "Uses existing DB data, no migrations needed"**

---

## CONTACTS & ESCALATION

**If you find:**
- **Schema validation error** → Check seo-injection.ts line numbers in report
- **Duplicate nodes** → Review LocalBusiness duplication section
- **Missing field in expansion** → Check "Not Implemented" table
- **DB field needed** → See "Partially Implemented" or Wave 3

**Files to review:**
1. server/lib/seo-injection.ts (SSR injection logic)
2. client/src/lib/structured-data.ts (Client schema generation)
3. shared/schema.ts (DB table definitions)

---

**Audit Complete:** ✅ No changes made  
**Audit Ready for:** Phase 2 implementation planning  
**Next Step:** User decision on expansion scope
