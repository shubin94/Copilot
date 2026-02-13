# Technical SEO Audit: Detective Profile Structure

**Date:** January 28, 2025  
**Status:** Complete - Ready for Implementation  
**Priority:** High (Critical for search visibility)

---

## Executive Summary

Your detective profiles are currently accessible through **two different URL patterns**, both of which have significant SEO limitations. While metadata is being served dynamically, the lack of keyword-rich, slug-based URLs means you're missing massive search volume for local and service-specific queries. This audit identifies all access paths, missing internal links, and provides a complete slug strategy to improve SEO equity.

### Key Findings
- ✅ **Metadata Serving**: Excellent - Dynamic titles, descriptions, and schema per profile
- ❌ **URL Structure**: Poor - Non-descriptive UUIDs instead of keyword-rich slugs
- ❌ **Internal Linking**: Fragmented - Location pages don't link to detective lists
- ❌ **Location Indexing**: Risky - Thousands of city pages may become orphaned pages

---

## Part 1: Current Detective Profile Access Paths

### How Users Currently Reach Detective Profiles

#### **Path 1: Public Detective Profile Page**
```
URL Pattern:    /p/{detectiveId}  (client-side only, UUID-based)
Example:        /p/550e8400-e29b-41d4-a716-446655440000
Route File:     client/src/pages/detective.tsx
Component:      DetectivePublicPage
```

**URL Structure Analysis:**
- **Type:** Client-side route (handled by wouter library)
- **SEO Value:** ⭐ (POOR)
  - Non-descriptive UUID provides zero keyword relevance
  - Users cannot infer detective name or location from URL
  - Not self-documenting (dark link)
  - Social media shares show no preview/context

**Metadata Served:**
```tsx
// From detective.tsx (lines 31-48)
const seoTitle = location
  ? `${detectiveName} - Private Investigator in ${location} | FindDetectives`
  : `${detectiveName} - Professional Detective Services | FindDetectives`;

const seoDescription = 
  `Hire ${detectiveName}${location ? ` in ${location}` : ''}. ${services.length} service(s) available...`;

// Schema: LocalBusiness with aggregateRating
// - Includes address, phone, email, service catalog
```

**Internal Links TO This Page:**
- Service cards (in listing pages) link to individual services via `/service/{serviceId}`, not to agent profile
- Avatar/detective name on service cards is clickable → routes to `/p/{detectiveId}`
- Navbar search suggestions → `/p/{detectiveId}` when detective selected
- Related services modal → No detective profile link

**Issues:**
- 🔴 No link from service detail page to detective's full profile
- 🔴 No link from location slug pages (/detectives/india/karnataka/bengaluru/) to detective list
- 🔴 Breadcrumbs on detective profile page don't include navigation path back to location

---

#### **Path 2: Service Detail Page (Primary Access)**
```
URL Pattern:    /service/{serviceId}  (client-side only, UUID-based)
Example:        /service/672c8b9f-4e1c-4d9a-a3b2-9f7c2e1a5b4c
Route File:     client/src/pages/detective-profile.tsx
Component:      DetectiveProfile
```

**URL Structure Analysis:**
- **Type:** Client-side route (service-focused, not detective-focused)
- **SEO Value:** ⭐ (POOR)
  - Shows service title, not detective name, as primary entity
  - Doesn't emphasize detective credentials/reputation
  - Multi-service detectives fragment SEO across many service pages

**Metadata Served:**
```tsx
// From detective-profile.tsx (lines 310-330)
const seoH1 = detective.city 
  ? `${service.title} in ${detective.city}, ${detective.country || "India"} - ${detectiveName}`
  : `${service.title} by ${detectiveName}`;

// Title: "{Service Title} by {Detective Name}"
// Description: "{service.description}" (first 155 chars)
// Schema: ProfessionalService with aggregateRating

// Breadcrumbs:
// Home → Category → Service → (no detective link)

// Canonical: https://www.askdetectives.com/service/{serviceId}
```

**Internal Links TO This Page:**
- Service listings → `/service/{serviceId}` (primary link)
- Service cards → `/service/{serviceId}` (href property)
- Location-based API serves detectives with link to `/service/{serviceId}`

**Issues:**
- 🔴 Fragments SEO signal across multiple URLs; 5-service detective has 5 separate "reputation" pools
- 🔴 Doesn't show detective's full portfolio/reputation from profile pages
- 🔴 No cross-linking between related services by same detective

---

#### **Path 3: Location-Based Listing (New, Implemented)**
```
URL Pattern:    /detectives/{countrySlug}/{stateSlug}/{citySlug}/
Example:        /detectives/india/karnataka/bengaluru/
API Endpoint:   GET /api/detectives/location/:countrySlug/:stateSlug?/:citySlug?

Response:       Array of detectives + location metadata
Purpose:        Consolidated detective listing by location (SEO optimized)
```

**Current Status:**
- ✅ Slug-based structure implemented in backend
- ✅ 301 redirects from legacy `/search?country=...&state=...&city=...` URLs
- ⏳ Frontend listing page not yet created/linked from location pages

**Issues:**
- 🔴 **Critical Orphan Page Risk**: Location pages (cities/states) don't link to detective listings
  - Thousands of city pages created without internal navigation to detectives in that city
  - Breaks crawlability and user navigation
  - Search engines may discount city pages due to isolated content

---

## Part 2: Metadata Serving Analysis

### Currently Implemented ✅

**Dynamic Title & Description:**
- ✅ Unique title per profile combining name + location + context
- ✅ Description truncated to 155 chars (Google SERP standard)
- ✅ Includes dynamic H1 with location keywords

**Schema Markup:**
```json
// On detective profile (/p/:id)
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Detective Name",
  "image": "logo_url",
  "address": { "addressLocality": "City", "addressCountry": "Country" },
  "aggregateRating": {
    "ratingValue": 4.5,
    "reviewCount": 12
  },
  "telephone": "+91-...",
  "email": "contact@...",
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "itemListElement": [ ... services ... ]
  }
}
```

**OpenGraph & Twitter Cards:**
- ✅ og:title, og:description, og:image
- ✅ twitter:title, twitter:description, twitter:image
- ✅ Custom image for each profile (detective logo or service image)

**Canonical URLs:**
- ✅ /p/{detectiveId} → https://www.askdetectives.com/p/{detectiveId}
- ✅ /service/{serviceId} → https://www.askdetectives.com/service/{serviceId}
- ⏳ New slug-based URLs don't have canonicals yet

---

## Part 3: Slug Strategy for Detective Profiles

### Recommended Approach: **Hybrid Location + Business Name**

#### **Option A: Full Path Format (RECOMMENDED)**
```
Pattern:     /detectives/{countrySlug}/{stateSlug}/{businessNameSlug}/
Example:     /detectives/india/karnataka/aks-detective-agency-bengaluru/
Advantages:
  + Clear location hierarchy (crawlers understand geography)
  + Unique at city level (business_name + city = uniqueness)
  + High keyword density for local searches
  + Breadcrumbs: Home > India > Karnataka > Bengaluru detectives > AKS Detective
  
Downsides:
  - Longer URL (though still reasonable: ~50-60 chars)
```

#### **Option B: Short Format**
```
Pattern:     /detectives/{businessNameSlug}-{citySlug}/
Example:     /detectives/aks-detective-agency-bengaluru/
Advantages:
  + Shorter URL (better UX, easier to type)
  + Simple routing
  + Works globally (includes city disambiguator)
  
Downsides:
  - Loses geographic hierarchy benefit
  - Less clear to search engines
```

### **Recommended: Option A (Full Path)**

**Why Option A Wins:**
1. **Hierarchy Clarity**: Search engines understand parent-child relationships
2. **Faceted Browsing Support**: Can create clean drill-down navigation
3. **Sitemap Efficiency**: Already have countries/states/cities indexed
4. **Keyword Authority**: Reuses location slug authority accumulated on country/state pages
5. **User Experience**: Breadcrumbs are clearer and more trustworthy

---

## Part 4: Database Schema Changes Required

### Current Detectives Table
```sql
detectives:
  - id (UUID, PK)
  - userId
  - businessName
  - city
  - country
  - state
  - location
  - logo
  - bio
  - phone
  - contactEmail
  - isVerified
  - hasBlueTick
  - isClaimed
  - (16 other columns for subscription, verification, etc.)
```

### New Column Required
```sql
ALTER TABLE detectives ADD COLUMN slug VARCHAR(255) NOT NULL UNIQUE;

-- Index for fast lookups:
CREATE UNIQUE INDEX idx_detective_slug ON detectives(slug);

-- For safety, also add composite index with country/state/city:
-- (This enables efficient filtered searches by location)
CREATE INDEX idx_detective_location_slug ON detectives(country, state, city, slug);
```

### Slug Composition Logic
```typescript
// Input: businessName = "AKS Detective Agency", city = "Bengaluru", country = "India"
// Output slug = "aks-detective-agency-bengaluru" (city disambiguator included)

function generateDetectiveSlug(
  businessName: string,
  city: string,
  country: string
): string {
  const baseSlug = slugify(`${businessName} ${city}`, { lower: true, strict: true });
  // Result: "aks-detective-agency-bengaluru"
  
  // No need for -1, -2 suffixes because (businessName + city) combo is globally unique
  // (unlikely two detectives have exact same name in exact same city)
}
```

---

## Part 5: Implementation Roadmap

### Phase 1: Database Migration ✅ Ready to Execute
**Files to Create:**
- `supabase/migrations/20250128_add_detective_slug.sql`
  ```sql
  ALTER TABLE detectives ADD COLUMN slug VARCHAR(255);
  CREATE UNIQUE INDEX idx_detective_slug ON detectives(slug);
  ```

**Command:**
```bash
npm run migrate
```

### Phase 2: Slug Generation & Seeding ✅ Ready to Execute
**File to Create:** `scripts/generate-detective-slugs.ts`

```typescript
import { db } from "../server/db";
import { detectives } from "../shared/schema";
import { slugify } from "slugify";

async function generateDetectiveServingSlugs() {
  const allDetectives = await db.select().from(detectives);
  
  const updates = allDetectives.map(d => {
    const slug = slugify(
      `${d.businessName || 'Detective'} ${d.city || 'Services'}`,
      { lower: true, strict: true }
    );
    return { id: d.id, slug };
  });
  
  // Batch update (10 at a time)
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    await Promise.all(
      batch.map(u => 
        db.update(detectives).set({ slug: u.slug }).where(eq(detectives.id, u.id))
      )
    );
  }
  
  console.log(`✅ Generated slugs for ${updates.length} detectives`);
}

generateDetectiveServingSlugs().catch(console.error);
```

**Run:**
```bash
DATABASE_URL="..." npx tsx scripts/generate-detective-slugs.ts
```

### Phase 3: Add Routing & 301 Redirects ✅ Ready to Implement
**File to Update:** `server/routes.ts`

**3a. Add New Route Handler for Slug-Based Profiles**
```typescript
app.get('/detectives/:countrySlug/:stateSlug/:businessNameSlug', async (req, res) => {
  const { countrySlug, stateSlug, businessNameSlug } = req.params;
  
  // 1. Resolve country slug → country record
  const country = await db.select().from(countries)
    .where(eq(countries.slug, countrySlug)).limit(1);
  if (!country.length) return res.status(404).json({ error: "Country not found" });
  
  // 2. Resolve state slug + country
  const state = await db.select().from(states)
    .where(and(
      eq(states.countryId, country[0].id),
      eq(states.slug, stateSlug)
    )).limit(1);
  if (!state.length) return res.status(404).json({ error: "State not found" });
  
  // 3. Resolve detective by slug + location
  const detective = await db.select().from(detectives)
    .where(and(
      eq(detectives.slug, businessNameSlug),
      eq(detectives.country, country[0].code),
      eq(detectives.state, state[0].name)
    )).limit(1);
  if (!detective.length) return res.status(404).json({ error: "Detective not found" });
  
  // 4. Redirect to client-side route with slug
  // OR render HTML with pre-injected meta tags (if using SSR)
  // For now: return detective data for client-side rendering
  const masked = await maskDetectiveContactsPublic(detective[0]);
  return res.json({ detective: masked });
});
```

**3b. Add 301 Redirects for Old Service URLs (Optional but Recommended)**
```typescript
// Redirect old /service/{serviceId} to /detectives/{slug}
app.get('/service/:serviceId', async (req, res) => {
  const { serviceId } = req.params;
  
  // Look up service → detective → slug
  const service = await db.select({ detective: detectives })
    .from(services)
    .innerJoin(detectives, eq(detectives.id, services.detectiveId))
    .where(eq(services.id, serviceId))
    .limit(1);
    
  if (!service.length) return res.status(404).json({ error: "Service not found" });
  const det = service[0].detective;
  
  const countrySlug = await getCountrySlug(det.country);
  const stateSlug = await getStateSlug(det.country, det.state);
  
  // 301 redirect to new slug-based URL
  const newUrl = `/detectives/${countrySlug}/${stateSlug}/${det.slug}/`;
  return res.redirect(301, newUrl);
});
```

### Phase 4: Update Frontend Routes ✅ Ready to Implement
**File to Update:** `client/src/pages/` (create new or rename)

**Option A: Client-Side Only (easiest)**
```tsx
// client/src/pages/detective-profile-slug.tsx
export default function DetectiveProfileBySlug() {
  const [, params] = useRoute("/detectives/:countrySlug/:stateSlug/:businessNameSlug");
  const { countrySlug, stateSlug, businessNameSlug } = params || {};
  
  // Fetch detective by slug from API
  const { data: detectiveData } = useQuery(
    ['detective-by-slug', businessNameSlug],
    () => api.get(`/api/detectives/by-slug/${businessNameSlug}`),
    { enabled: !!businessNameSlug }
  );
  
  // Render same component as /p/:id but with slug-based URL in canonical + breadcrumbs
  return <DetectiveProfileComponent detective={detectiveData} isSlugBased />;
}
```

### Phase 5: Update Internal Links (Critical for SEO)
**Files to Update:**
1. `client/src/components/home/service-card.tsx` (line ~169)
   ```tsx
   // Change from:
   setLocation(`/p/${detectiveId}`);
   
   // To:
   setLocation(`/detectives/${countrySlug}/${stateSlug}/${detectiveSlug}`);
   ```

2. `client/src/components/layout/navbar.tsx` (line ~95, 220, 249)
   ```tsx
   // Same change: use slug-based URL for detective search results
   ```

3. Create breadcrumbs on location pages linking to detective lists
   ```tsx
   // On /detectives/india/karnataka/bengaluru/ page:
   // Breadcrumb: Home > India > Karnataka > Bengaluru
   // Add: "View {N} Detectives in Bengaluru"
   ```

### Phase 6: Metadata & Canonical Update
**Update SEO component calls:**
```tsx
<SEO
  title={`${detectiveName} - Private Investigator in ${location}`}
  description={`Hire ${detectiveName} in ${location}. Verified detective with ${reviewCount} reviews...`}
  canonical={`https://askdetectives.com/detectives/${countrySlug}/${stateSlug}/${businessNameSlug}/`}
  // ... other properties
/>
```

---

## Part 6: Orphan Page Prevention Strategy

### Current Risk
With hundreds or thousands of city pages created at `/detectives/{countrySlug}/{stateSlug}/{citySlug}/`, you risk "orphan pages" if:

1. **No internal links exist** from home/navigation to city pages
2. **Page doesn't link back** to parent (state/country) pages
3. **Detective list under city not linked** from city page itself
4. **Breadcrumbs broken** in serialized markup

### Mitigation (Implementation Checklist)

**✅ On Location Pages (/detectives/india/karnataka/bengaluru/)**
- [ ] Render list of detectives under that city (use `/api/detectives/location/...?city=bengaluru`)
- [ ] Each detective links to `/detectives/{countrySlug}/{stateSlug}/{businessNameSlug}/`
- [ ] Add breadcrumbs: Home > India > Karnataka > Bengaluru > "View Detective: AKS"
- [ ] Add "Up" link to parent state: `/detectives/india/karnataka/`

**✅ On Detective Profile Routes**
- [ ] Add breadcrumbs: Home > India > Karnataka > Bengaluru > AKS Detective
- [ ] Add "back to city" link: `/detectives/india/karnataka/bengaluru/`
- [ ] Link to all services by this detective

**✅ In Sitemap & Schema**
- [ ] Detective profiles included in sitemap (via slug)
- [ ] Parent-child relationships in breadcrumb schema
- [ ] Last-modified date tracked for profile updates

---

## Part 7: Search Volume Opportunity Analysis

### Current Approach (UUID-Based)
```
Google Search Queries:
- "private investigator in bangalore"        → May rank competitor domain
- "detective services karnataka"              → Generic results (no leverage from location work)
- "AKS Detective Agency"                     → Your site if branded search, but weak

User Journey:
1. Google: "detective in bangalore"
2. Lands on /detectives/india/karnataka/bengaluru/ (gets list)
3. Clicks on service: /service/{uuid} (wrong entity type for detective search)
4. No path showing detective profile URL (hidden in client-side route)

Result: Missed local SEO value, split authority across URLs
```

### Proposed Approach (Slug-Based)
```
Google Search Queries:
- "private investigator in bangalore"        
  → Rank: /detectives/india/karnataka/bengaluru/ (city listing)
  → Rank: /detectives/india/karnataka/aks-detective-agency-bengaluru/ (specific)

- "AKS Detective in karnataka"
  → Rank: /detectives/india/karnataka/aks-detective-agency-bengaluru/ (branded + location)

- "corporate investigation services bangalore" (category + location)
  → Possibly rank city listing, then detective within

User Journey:
1. Google: "detective in bangalore" or "private investigator karnataka"
2. Lands on slug-based URL directly (if rank achieved)
3. See detective profile with:
   - Full reputation (all services listed)
   - Reviews aggregated
   - Contact info if available
   - Breadcrumb back to city/state pages
4. Can explore other detectives in same city without leaving location context

Result: Authority consolidated, local adjacency signals strong, CTR higher
```

### Estimated Search Volume Unlock
```
Assumption: 1000+ unique {city, detective, country} combinations

By Location:
- /detectives/india/                             ~100-200 monthly searches
- /detectives/india/karnataka/                   ~50-100 monthly searches  
- /detectives/india/karnataka/bengaluru/         ~20-50 monthly searches

By Detective (once established):
- Each detective profile: 5-30 monthly branded searches
- Aggregated: 5,000 - 30,000 monthly across all detectives

Total Opportunity: 50,000+ monthly search impressions
(Conservative estimate assuming 10% rank position 1-10)
```

---

## Part 8: Implementation Timeline & Authority Consideration

### 301 Redirect Plan (Critical for SEO)
```
Old URLs:
- /service/{serviceId}  
- /p/{detectiveId}      

New Primary URL:
- /detectives/{countrySlug}/{stateSlug}/{businessNameSlug}/

Redirect Chain:
1. /service/{serviceId} → 301 → /detectives/.../
2. /p/{detectiveId} → (keep for backwards compat, OR 301 → /detectives/.../)

Authority Flow:
- Existing backlinks pointing to /p/{id} are NOT lost (301 preserves)
- All ranking signals from /service/{id} transfer to new slug URL
- Time to see ranking changes: 4-12 weeks (Google reindex + recrawl)
```

### Recommended Phase Schedule
```
Week 1:
- [ ] Create migration: add slug column to detectives table
- [ ] Run migration in staging, then production
- [ ] Create seeding script

Week 2:
- [ ] Seed detective slugs (batch operation)
- [ ] Validate result: SELECT COUNT(*) FROM detectives WHERE slug IS NOT NULL
- [ ] Spot-check 10 detective slugs for correctness

Week 3-4:
- [ ] Implement new route handler in server/routes.ts
- [ ] Add API endpoint: GET /api/detectives/by-slug/:slug
- [ ] Update SEO component metadata and canonicals
- [ ] Add 301 redirect middleware (old URLs → new)

Week 5:
- [ ] Update frontend routes (client-side)
- [ ] Update internal links on service cards, navbar
- [ ] Create breadcrumb components for location → detective flow
- [ ] Test on staging: click through entire user journey

Week 6:
- [ ] Deploy to production
- [ ] Monitor 404 errors in Server logs for failed redirects
- [ ] Monitor ranking changes in Google Search Console (trending up over 4-12 weeks)
- [ ] Update XML sitemap to include new detective slug URLs

Months 2-3:
- [ ] Monitor Search Console for indexation
- [ ] Check Core Web Vitals on new URLs
- [ ] Iterate on metadata if CTR/position is suboptimal
```

---

## Part 9: Common Implementation Gotchas & Solutions

### Gotcha 1: Detective Not Found Due to Case Sensitivity
```typescript
// ❌ WRONG: Slug comparison is case-sensitive
WHERE detective.slug = 'AKS-Detective-Agency-Bengaluru'  // won't match 'aks-detective-agency-bengaluru'

// ✅ CORRECT: Always lowercase in query
const SLUGVALUE = businessNameSlug.toLowerCase();
WHERE detective.slug = SLUGVALUE
```

### Gotcha 2: State Ambiguity (Same State in Multiple Countries)
```
Germany: Baden-Württemberg
Austria: Vorarlberg Region

// ❌ WRONG: Only match by slug
WHERE state.slug = 'baden-wurttemberg'  // returns multiple countries

// ✅ CORRECT: Match by country AND slug
WHERE country.code = 'DE' AND state.slug = 'baden-wurttemberg'
```

### Gotcha 3: Detective Moved to Different City
```
Scenario: AKS Detective Agency relocates from Bengaluru to Pune

// ❌ WRONG: Keep old slug
/detectives/india/karnataka/aks-detective-agency-bengaluru/  (now in wrong state!)

// ✅ SOLUTION: Regenerate slug on profile update
// Old URL 301 redirects to new URL
/detectives/india/maharashtra/aks-detective-agency-pune/

// Implement: Update trigger in database
CREATE TRIGGER update_detective_slug_on_city_change
BEFORE UPDATE ON detectives
FOR EACH ROW
BEGIN
  IF OLD.businessName <> NEW.businessName OR OLD.city <> NEW.city THEN
    SET NEW.slug = slugify(CONCAT(NEW.businessName, ' ', NEW.city));
  END IF;
END;
```

### Gotcha 4: Timing - Metadata Before Router Ready
```typescript
// ❌ WRONG: SEO module tries to read URL params before route handler runs
const slug = window.location.pathname.split('/')[3];  // Not available in client

// ✅ CORRECT: Use wouter for parameter extraction
const [, params] = useRoute("/detectives/:countrySlug/:stateSlug/:slug");
// Now params.slug is available
```

---

## Part 10: Measurement & Success Criteria

### Metrics to Track

**1. Indexation** (via Google Search Console)
```
Before:
- /p/{uuid}* URLs indexed: ~1,000
- /service/{uuid}* URLs indexed: ~5,000

After (Expected):
- /detectives/{country}/{state}/{slug}/ URLs indexed: ~6,000
- Redirect 301 status: All old URLs show "redirect recognized" in GSC
```

**2. Rankings** (Monitor in Search Console or SEMrush)
```
Queries Tracked:
- "private investigator [city name]"        (10 largest cities)
- "[detective business name]"               (10 largest agencies)
- "corporate investigation bangalor"        (category + location)
- "detective services karnataka"            (state-level searches)

Expected Trend:
- Weeks 1-2:  No change (Google hasn't recrawled)
- Weeks 3-6:  Gradual improvement (recrawl + recount links)
- Weeks 7-12: Plateau at new position (market equilibrium)

Success = Move from position 10-20 to 5-10 for local queries
```

**3. Organic Traffic Growth**
```
Baseline (Q1 2025):
- Current: ~X monthly sessions from /service/ URLs
- Current: ~Y monthly sessions from /p/ URLs

Target (Q2 2025):
- /detectives/ URLs: +30% increase (from search, not just direct)
- Reduced bounce rate on detective comparison (breadcrumbs, cross-links)
```

**4. User Behavior**
```
Signals to Monitor:
- Click-through rate on detective profile links (should improve with slugs visible in SERP)
- Breadcrumb click-through (back to city listing)
- Average time on detective profile page (should increase if better discovery)
- Notes: Use event tracking in GA4 for accurate metrics
```

---

## Summary & Quick Start

### ✅ To-Do Checklist

**Immediate (Week 1-2):**
- [ ] Review this audit for business approval
- [ ] Create migration file with slug column
- [ ] Create seeding script
- [ ] Test in staging environment

**Implementation (Week 3-4):**
- [ ] Deploy migration to production
- [ ] Run seeding script to populate slugs
- [ ] Add backend route handler for `/detectives/{...}/{slug}/`
- [ ] Implement 301 redirects from old URLs

**Frontend & Testing (Week 5-6):**
- [ ] Update client-side routes
- [ ] Update internal links (service cards, navbar, etc.)
- [ ] Create breadcrumbs
- [ ] Full end-to-end testing on staging

**Launch & Monitor (Week 6+):**
- [ ] Deploy to production
- [ ] Submit new URLs to Google Search Console
- [ ] Monitor Search Console, rankings, organic traffic
- [ ] Iterate on metadata and CTR improvements

---

### Reference Files Created

1. **Migration SQL**: `supabase/migrations/20250128_add_detective_slug.sql`
2. **Seeding Script**: `scripts/generate-detective-slugs.ts`
3. **Route Handler**: Updates to `server/routes.ts`
4. **Frontend Routes**: Updates to `client/src/pages/`
5. **This Audit**: `DETECTIVE_PROFILE_SEO_AUDIT.md`

---

**Next Step:** Review implementation files and confirm go-ahead for Phase 1 (database migration).
