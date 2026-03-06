# Final JSON-LD Schema Output Examples

## Summary of Fixes

✅ **Issue 1: Breadcrumb Country Labels**
- **Before:** `"name": "IN"` (database code)
- **After:** `"name": "India"` (human-readable)
- Slug remains lowercase: `/detectives/india/`

✅ **Issue 2: Organization/WebSite Arrays**
- **Before:** Single script tag with array containing both schemas
- **After:** Two separate script tags, each with single JSON object

✅ **No Arrays Anywhere**
- Each JSON-LD script contains exactly ONE valid JSON object
- No array wrappers: `[{ ... }]`
- All LocalBusiness, BreadcrumbList, Organization, WebSite are standalone objects

---

## Detective Profile Page Output

### Input Request
```
GET /detectives/india/maharashtra/pune/rustamehindespydetectivesllp/
```

### Head Section HTML (Final)

```html
<!-- 3 separate script tags in <head> -->

<!-- Script 1: LocalBusiness schema (from SEO injection) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://www.askdetectives.com/detectives/india/maharashtra/pune/rustamehindespydetectivesllp/",
  "name": "Rustam E Hindes Spy Detectives LLP",
  "description": "Professional private investigator specializing in corporate investigations...",
  "url": "https://www.askdetectives.com/detectives/india/maharashtra/pune/rustamehindespydetectivesllp/",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Pune",
    "addressRegion": "Maharashtra",
    "addressCountry": "IN"
  },
  "telephone": "+91-9876543210",
  "areaServed": "Pune, Maharashtra",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": 156
  }
}
</script>

<!-- Script 2: BreadcrumbList schema (from SEO injection) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.askdetectives.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "India",
      "item": "https://www.askdetectives.com/detectives/india/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Maharashtra",
      "item": "https://www.askdetectives.com/detectives/india/maharashtra/"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Pune",
      "item": "https://www.askdetectives.com/detectives/india/maharashtra/pune/"
    },
    {
      "@type": "ListItem",
      "position": 5,
      "name": "Rustam E Hindes Spy Detectives LLP",
      "item": "https://www.askdetectives.com/detectives/india/maharashtra/pune/rustamehindespydetectivesllp/"
    }
  ]
}
</script>

<!-- Script 3: Organization schema (from index.html - FIXED) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Ask Detectives",
  "url": "https://www.askdetectives.com",
  "logo": "https://www.askdetectives.com/favicon.png",
  "sameAs": ["https://twitter.com/FindDetectives"],
  "areaServed": "Worldwide",
  "description": "Find vetted private investigators and detective services."
}
</script>

<!-- Script 4: WebSite schema (from index.html - NOW SEPARATE) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://www.askdetectives.com/",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.askdetectives.com/search?search={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
```

### Schema Breakdown

| Script | Type | Content | Source |
|--------|------|---------|--------|
| 1 | LocalBusiness | Detective profile information, ratings, contact | SEO injection |
| 2 | BreadcrumbList | Navigation path with human-readable labels | SEO injection |
| 3 | Organization | Site organization info | index.html (default) |
| 4 | WebSite | Search functionality metadata | index.html (default) |

**Total Scripts:** 4 separate tags, **ZERO arrays**

---

## Location Listing Page Output

### Input Request
```
GET /detectives/india/
```

### Head Section HTML (Final)

```html
<!-- 3 separate script tags in <head> -->

<!-- Script 1: ItemList schema (from SEO injection) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Private Detectives in India",
  "description": "Directory of private detectives and investigators in India",
  "url": "https://www.askdetectives.com/detectives/india/",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "url": "https://www.askdetectives.com/detectives/india/maharashtra/pune/rustamehindespydetectivesllp/",
      "name": "Rustam E Hindes Spy Detectives LLP"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/ajaysmith-pvt-ltd/",
      "name": "Ajay Smith Pvt Ltd"
    }
  ]
}
</script>

<!-- Script 2: BreadcrumbList schema (from SEO injection) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.askdetectives.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "India",
      "item": "https://www.askdetectives.com/detectives/india/"
    }
  ]
}
</script>

<!-- Script 3: Organization schema (from index.html - FIXED) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Ask Detectives",
  "url": "https://www.askdetectives.com",
  "logo": "https://www.askdetectives.com/favicon.png",
  "sameAs": ["https://twitter.com/FindDetectives"],
  "areaServed": "Worldwide",
  "description": "Find vetted private investigators and detective services."
}
</script>

<!-- Script 4: WebSite schema (from index.html - NOW SEPARATE) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://www.askdetectives.com/",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.askdetectives.com/search?search={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
```

### Schema Breakdown

| Script | Type | Content | Source |
|--------|------|---------|--------|
| 1 | ItemList | List of detectives at location | SEO injection |
| 2 | BreadcrumbList | Navigation path: Home → India | SEO injection |
| 3 | Organization | Site organization info | index.html (default) |
| 4 | WebSite | Search functionality metadata | index.html (default) |

**Total Scripts:** 4 separate tags, **ZERO arrays**

---

## Key Improvements

### ✅ Breadcrumb Country Labels (FIXED)

**Before:**
```json
{
  "@type": "ListItem",
  "position": 2,
  "name": "IN",
  "item": "https://www.askdetectives.com/detectives/IN/"
}
```

**After:**
```json
{
  "@type": "ListItem",
  "position": 2,
  "name": "India",
  "item": "https://www.askdetectives.com/detectives/india/"
}
```

**Mapping Function:**
```typescript
function getCountryName(country: string): string {
  const codeToName: Record<string, string> = {
    'IN': 'India',
    'US': 'United States',
    'GB': 'United Kingdom',
    'CA': 'Canada',
    // ... 30+ countries
  };
  return codeToName[country.toUpperCase()] || country;
}
```

### ✅ Organization/WebSite No Longer in Array (FIXED)

**Before (index.html):**
```html
<script type="application/ld+json">
  [
    { "@type": "Organization", ... },
    { "@type": "WebSite", ... }
  ]
</script>
```

**After (index.html):**
```html
<!-- Script 1 -->
<script type="application/ld+json">
{ "@type": "Organization", ... }
</script>

<!-- Script 2 -->
<script type="application/ld+json">
{ "@type": "WebSite", ... }
</script>
```

---

## Country Code Mapping (30+ Countries)

Supported country codes mapped to:
1. **Name** (for BreadcrumbList display)
2. **Slug** (for URL paths)

| Code | Name | Slug |
|------|------|------|
| IN | India | india |
| US | United States | united-states |
| GB | United Kingdom | united-kingdom |
| CA | Canada | canada |
| AU | Australia | australia |
| DE | Germany | germany |
| FR | France | france |
| IT | Italy | italy |
| ES | Spain | spain |
| NZ | New Zealand | new-zealand |
| IE | Ireland | ireland |
| SG | Singapore | singapore |
| MY | Malaysia | malaysia |
| PH | Philippines | philippines |
| TH | Thailand | thailand |
| VN | Vietnam | vietnam |
| PK | Pakistan | pakistan |
| BD | Bangladesh | bangladesh |
| ZA | South Africa | south-africa |
| AE | United Arab Emirates | united-arab-emirates |

---

## Validation Checklist

✅ **LocalBusiness** - Single script, standalone object (not in array)
✅ **BreadcrumbList** - Single script, standalone object (not in array)
✅ **Organization** - Single script, standalone object (not in array)
✅ **WebSite** - Single script, standalone object (not in array)
✅ **NO ARRAYS** - Zero array-wrapped JSON-LD anywhere
✅ **Country Names** - All breadcrumbs use human-readable names (India, not IN)
✅ **URL Slugs** - All URLs use lowercase slugs (/detectives/india/, not /detectives/IN/)
✅ **TypeScript** - 0 compilation errors
✅ **Separate Scripts** - Each schema type in its own `<script type="application/ld+json">` tag

---

## Files Modified

1. **server/lib/seo-injection.ts**
   - Added `getCountryName()` function mapping 30+ country codes to display names
   - Updated `generateDetectiveBreadcrumbSchema()` to use human-readable country names
   - Updated `generateLocationBreadcrumbSchema()` to use human-readable country names
   - All other functions remain compatible

2. **client/index.html**
   - Split Organization and WebSite from single array into two separate script tags
   - Each tag now contains a single valid JSON object
   - No changes to the actual schema content, only structure

---

## Deployment Notes

✅ **No Breaking Changes**
- Internal schema function modifications only
- Route handlers unchanged
- Database queries unchanged
- HTML injection points unchanged

✅ **Search Engine Compatibility**
- Better parser compatibility with separate scripts
- Proper schema structure per schema.org
- All required properties maintained

✅ **No Database Changes**
- Pure presentation layer modifications
- Data storage unchanged

✅ **Backward Compatible**
- Existing breadcrumb URLs still work
- Country code database values unchanged
- API responses unaffected
