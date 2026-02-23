# Location Listing Pages - SEO Injection Examples

This document demonstrates the server-side SEO tag injection for location listing pages in the detective directory.

## Overview

Location listing pages (`/detectives/:country`, `/detectives/:country/:state`, `/detectives/:country/:state/:city`) now include server-side meta tag injection to improve SEO.

The injected content includes:
- Dynamic `<title>` tags
- Meta description with detective count
- Open Graph (OG) tags for social sharing
- Canonical URL
- JSON-LD schemas (ItemList + BreadcrumbList)
- Twitter Card tags

## Route Patterns

| Route Pattern | Example | Location Type | Segments |
|---|---|---|---|
| `/detectives/:country` | `/detectives/india` | Country level | 2 |
| `/detectives/:country/:state` | `/detectives/india/maharashtra` | State level | 3 |
| `/detectives/:country/:state/:city` | `/detectives/india/maharashtra/mumbai` | City level | 4 |

---

## Example 1: Country-Level Page

**Request:** `/detectives/india/`

**URL Parameters Detected:**
- Country: India
- State: (none)
- City: (none)

### Injected HTML Head Section

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO TITLE INJECTION POINT -->
    <title>Private Detectives in India | Find Professional Investigators | Ask Detectives</title>
    
    <!-- SEO META INJECTION POINT -->
    <meta name="description" content="Find verified private detectives in India. Compare 285+ profiles, ratings, and services. Contact professional investigators in your city. Licensed, experienced, and trusted." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.askdetectives.com/detectives/india/" />
    <meta property="og:title" content="Private Detectives in India | Find Professional Investigators" />
    <meta property="og:description" content="Find verified private detectives in India. Compare 285+ profiles, ratings, and services." />
    <meta property="og:site_name" content="Ask Detectives" />
    <link rel="canonical" href="https://www.askdetectives.com/detectives/india/" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Private Detectives in India" />
    <meta name="twitter:description" content="Find verified private detectives in India. Compare 285+ profiles, ratings, and services. Contact professional investigators in your city." />
    
    <!-- SEO JSON LD INJECTION POINT -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Private Detectives in India",
      "description": "Find verified private detectives in India. Compare 285+ profiles, ratings, and services.",
      "url": "https://www.askdetectives.com/detectives/india/",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/john-kumar/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/pune/raj-sharma/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "url": "https://www.askdetectives.com/detectives/india/karnataka/bangalore/priya-singh/"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "url": "https://www.askdetectives.com/detectives/india/delhi/delhi/amit-patel/"
        },
        {
          "@type": "ListItem",
          "position": 5,
          "url": "https://www.askdetectives.com/detectives/india/tamil-nadu/chennai/deepa-gupta/"
        },
        {
          "@type": "ListItem",
          "position": 6,
          "url": "https://www.askdetectives.com/detectives/india/west-bengal/kolkata/vikram-bhat/"
        },
        {
          "@type": "ListItem",
          "position": 7,
          "url": "https://www.askdetectives.com/detectives/india/telangana/hyderabad/neha-reddy/"
        },
        {
          "@type": "ListItem",
          "position": 8,
          "url": "https://www.askdetectives.com/detectives/india/rajasthan/jaipur/ashok-kumar/"
        },
        {
          "@type": "ListItem",
          "position": 9,
          "url": "https://www.askdetectives.com/detectives/india/goa/panjim/shruti-sharma/"
        },
        {
          "@type": "ListItem",
          "position": 10,
          "url": "https://www.askdetectives.com/detectives/india/haryana/gurgaon/rohan-verma/"
        }
      ]
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.askdetectives.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Detectives",
          "item": "https://www.askdetectives.com/detectives/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "India",
          "item": "https://www.askdetectives.com/detectives/india/"
        }
      ]
    }
    </script>

    <script type="module" crossorigin src="/assets/main-abc123.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/style-def456.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

---

## Example 2: State-Level Page

**Request:** `/detectives/india/maharashtra/`

**URL Parameters Detected:**
- Country: India
- State: Maharashtra
- City: (none)

### Injected HTML Head Section

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO TITLE INJECTION POINT -->
    <title>Private Detectives in Maharashtra, India | Find Local Investigators | Ask Detectives</title>
    
    <!-- SEO META INJECTION POINT -->
    <meta name="description" content="Find verified private detectives in Maharashtra, India. Compare 47+ profiles, ratings, and services. Contact professional investigators in Mumbai, Pune, Nagpur, and more." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.askdetectives.com/detectives/india/maharashtra/" />
    <meta property="og:title" content="Private Detectives in Maharashtra, India | Find Local Investigators" />
    <meta property="og:description" content="Find verified private detectives in Maharashtra. Compare 47+ profiles, ratings, and services." />
    <meta property="og:site_name" content="Ask Detectives" />
    <link rel="canonical" href="https://www.askdetectives.com/detectives/india/maharashtra/" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Private Detectives in Maharashtra" />
    <meta name="twitter:description" content="Find verified private detectives in Maharashtra. Compare 47+ profiles, ratings, and services." />
    
    <!-- SEO JSON LD INJECTION POINT -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Private Detectives in Maharashtra, India",
      "description": "Find verified private detectives in Maharashtra, India. Compare 47+ profiles, ratings, and services.",
      "url": "https://www.askdetectives.com/detectives/india/maharashtra/",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/john-kumar/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/pune/raj-sharma/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/nagpur/priya-singh/"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/aurangabad/amit-patel/"
        },
        {
          "@type": "ListItem",
          "position": 5,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/nashik/deepa-gupta/"
        },
        {
          "@type": "ListItem",
          "position": 6,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/thane/vikram-bhat/"
        },
        {
          "@type": "ListItem",
          "position": 7,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/surat/neha-reddy/"
        },
        {
          "@type": "ListItem",
          "position": 8,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/kolhapur/ashok-kumar/"
        },
        {
          "@type": "ListItem",
          "position": 9,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/satara/shruti-sharma/"
        },
        {
          "@type": "ListItem",
          "position": 10,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/solapur/rohan-verma/"
        }
      ]
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.askdetectives.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Detectives",
          "item": "https://www.askdetectives.com/detectives/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "India",
          "item": "https://www.askdetectives.com/detectives/india/"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": "Maharashtra",
          "item": "https://www.askdetectives.com/detectives/india/maharashtra/"
        }
      ]
    }
    </script>

    <script type="module" crossorigin src="/assets/main-abc123.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/style-def456.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

---

## Example 3: City-Level Page

**Request:** `/detectives/india/maharashtra/mumbai/`

**URL Parameters Detected:**
- Country: India
- State: Maharashtra
- City: Mumbai

### Injected HTML Head Section

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO TITLE INJECTION POINT -->
    <title>Private Detectives in Mumbai, Maharashtra | Find Investigators | Ask Detectives</title>
    
    <!-- SEO META INJECTION POINT -->
    <meta name="description" content="Find verified private detectives in Mumbai, Maharashtra. Compare 12+ profiles, ratings, and services. Licensed investigators available for corporate investigations, personal cases, and more." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.askdetectives.com/detectives/india/maharashtra/mumbai/" />
    <meta property="og:title" content="Private Detectives in Mumbai, Maharashtra | Find Investigators" />
    <meta property="og:description" content="Find verified private detectives in Mumbai, Maharashtra. Compare 12+ profiles, ratings, and services." />
    <meta property="og:site_name" content="Ask Detectives" />
    <link rel="canonical" href="https://www.askdetectives.com/detectives/india/maharashtra/mumbai/" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Private Detectives in Mumbai" />
    <meta name="twitter:description" content="Find verified private detectives in Mumbai. Compare 12+ profiles, ratings, and services." />
    
    <!-- SEO JSON LD INJECTION POINT -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Private Detectives in Mumbai, Maharashtra",
      "description": "Find verified private detectives in Mumbai, Maharashtra. Compare 12+ profiles, ratings, and services.",
      "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/john-kumar/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/priya-singh/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/deepa-gupta/"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/vikram-bhat/"
        },
        {
          "@type": "ListItem",
          "position": 5,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/neha-reddy/"
        },
        {
          "@type": "ListItem",
          "position": 6,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/ashok-kumar/"
        },
        {
          "@type": "ListItem",
          "position": 7,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/shruti-sharma/"
        },
        {
          "@type": "ListItem",
          "position": 8,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/rohan-verma/"
        },
        {
          "@type": "ListItem",
          "position": 9,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/sanjay-patel/"
        },
        {
          "@type": "ListItem",
          "position": 10,
          "url": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/harsh-singh/"
        }
      ]
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.askdetectives.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Detectives",
          "item": "https://www.askdetectives.com/detectives/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "India",
          "item": "https://www.askdetectives.com/detectives/india/"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": "Maharashtra",
          "item": "https://www.askdetectives.com/detectives/india/maharashtra/"
        },
        {
          "@type": "ListItem",
          "position": 5,
          "name": "Mumbai",
          "item": "https://www.askdetectives.com/detectives/india/maharashtra/mumbai/"
        }
      ]
    }
    </script>

    <script type="module" crossorigin src="/assets/main-abc123.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/style-def456.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

---

## Implementation Details

### SEO Injection Functions

Located in `server/lib/seo-injection.ts`:

- **`isLocationListingPath(requestPath)`** - Detects if URL is a location listing route (2-4 segments)
- **`extractLocationRouteParams(requestPath)`** - Extracts country, state, city from URL
- **`getLocationDetectivesForSEO(country, state?, city?)`** - Fetches top 10 detective profiles for location
- **`generateLocationSeoMetaTags(location, detectiveCount, canonicalUrl)`** - Generates all meta tags
- **`generateLocationJsonLd(location, detectives, canonicalUrl)`** - Generates JSON-LD schemas
- **`injectLocationSeoTags(htmlContent, location, detectives, canonicalUrl)`** - Injects into HTML template

### Route Interception

Location routes are intercepted in both servers:

**Production** (`server/index-prod.ts`):
- Regex pattern: `/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/`
- Detects 2-4 segment location URLs
- Registered BEFORE detective profile route (5 segments) for correct precedence

**Development** (`server/index-dev.ts`):
- Same regex pattern
- Integrated with Vite `transformIndexHtml()` for development

### Caching Strategy

- **Production:** `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
  - 1 hour fresh cache
  - 24 hours stale cache allowed while revalidating
- **Development:** `Cache-Control: no-store`
  - No caching in development

### Error Handling

- If location has 0 detectives: Serves normal SPA (React handles empty state)
- If database query fails: Fallback to normal SPA
- If injection fails: Fallback to normal SPA
- All errors logged to console with `[SEO]` or `[DEV-SEO]` prefix

### Schema Elements

#### ItemList Schema
- Lists top 10 detective profiles for the location
- Each item includes position number and detective profile URL
- Helps search engines understand available detectives at location

#### BreadcrumbList Schema
- Shows site hierarchy: Home > Detectives > Country > [State] > [City]
- Improves navigation understanding in search results
- Enables breadcrumb display in SERPs

---

## Testing

### Manual Testing

1. **Country Level:**
   ```
   curl -I https://localhost:3000/detectives/india/
   # Should return 200 with injected meta tags
   ```

2. **State Level:**
   ```
   curl -I https://localhost:3000/detectives/india/maharashtra/
   # Should return 200 with injected meta tags
   ```

3. **City Level:**
   ```
   curl -I https://localhost:3000/detectives/india/maharashtra/mumbai/
   # Should return 200 with injected meta tags
   ```

### Search Engine Testing

1. **Google Search Console:**
   - Use URL Inspection tool to verify meta tags are injected
   - Check coverage report for location pages

2. **Rich Results Test:**
   - Test at `https://search.google.com/test/rich-results`
   - Verify ItemList and BreadcrumbList schemas are recognized

3. **OpenGraph Testing:**
   - Use `https://www.opengraphcheck.com/`
   - Verify OG tags for social preview

---

## Performance Impact

- No impact to client-side performance (still CSR)
- Minimal database queries (only top 10 detectives per request)
- Results cached at application level for 1 hour
- Vite dev server integration (no build step needed)

---

## Backward Compatibility

- Existing detective profile injections unchanged
- Route precedence preserved (location patterns before profile patterns)
- All existing SEO functionality maintained
- SPA behavior intact for routes without detectives

---

## Future Enhancements

1. **Image Optimization:** Add og:image tags with location-specific hero images
2. **Review Aggregation:** Include rating information in meta description
3. **Dynamic Descriptions:** Generate unique descriptions based on specializations
4. **Location Schema:** Add LocalSearchResultsPage schema for enhanced SERP features
5. **Caching:** Implement Redis caching for detective counts per location
