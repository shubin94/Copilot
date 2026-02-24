# SEO Injection Fixes - Code Reference

## The Faulty Query

**File:** `server/lib/seo-injection.ts` (lines 98-105)

```typescript
// ❌ BROKEN - Error: Cannot convert undefined or null to object
const ratingData = await db.select({
  avgRating: avg(reviews.rating),
  count: count(reviews.id),
}).from(reviews)
  .where(eq(reviews.detectiveId, detective.id));  // ← reviews.detectiveId DOES NOT EXIST!
```

**Why it breaks:**
```
reviews table columns: id, serviceId, userId, orderId, rating, comment, isPublished, createdAt
                       ❌ NO detectiveId field

Drizzle error when accessing undefined property:
  TypeError: Cannot convert undefined or null to object
  at Function.entries (<anonymous>)
  at orderSelectedFields (...)  ← Drizzle internal processing
```

---

## The Corrected Query

**File:** `server/lib/seo-injection.ts` (lines ~98-125)

```typescript
// ✅ CORRECT - Join through services table
console.log(`[SEO] Fetching ratings for detective ID: ${detective.id}`);

const ratingData = await db.select({
  avgRating: avg(reviews.rating),
  reviewCount: count(reviews.id),
})
  .from(services)
  .innerJoin(reviews, eq(reviews.serviceId, services.id))
  .where(
    and(
      eq(services.detectiveId, detective.id),    // Correct: services has detectiveId
      isNotNull(reviews.rating),
      eq(reviews.isPublished, true)
    )
  );

if (ratingData.length > 0 && ratingData[0]) {
  const data = ratingData[0];
  avgRating = data.avgRating ? Number(data.avgRating).toFixed(2) : 0;
  reviewCount = data.reviewCount ? Number(data.reviewCount) : 0;
  console.log(`[SEO] Found ${reviewCount} reviews with avg rating ${avgRating} for detective: ${detective.businessName}`);
} else {
  console.log(`[SEO] No published reviews found for detective: ${detective.businessName}`);
}
```

**Query path:**
```
Services table [has detectiveId]
    ↓
    innerJoin with Reviews table [has serviceId]
    ↓
Filter: Where services.detectiveId = given_detective_id
    AND reviews.rating is not null
    AND reviews.isPublished = true
    ↓
Aggregate: avg(rating), count(reviews)
```

---

## Error Handling Updates

### Profile Route Handler (Development)

**File:** `server/index-dev.ts` (lines 115-171)

**Before → After:**

```typescript
// BEFORE
if (!detective) {
  console.log('[SEO] Detective not found:', params);
  return attachViteTransform(vite, res, req, '');  // ← Falls back to SPA
}

// AFTER
if (!detective) {
  console.log("[SEO] Detective not found:", params);
  return res.status(404).set({ "Content-Type": "text/html" }).send(
    "<html><head><title>Detective Not Found</title></head><body><h1>404 - Detective not found</h1></body></html>"
  );  // ← Returns proper 404
}
```

**Error handling:**

```typescript
// BEFORE
} catch (error) {
  console.error('[DEV-SEO] Error:', error);
  return attachViteTransform(vite, res, req, '');  // ← Falls back to SPA
}

// AFTER
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error('[DEV-SEO] CRITICAL ERROR in profile handler:', {
    url: req.originalUrl,
    message: errorMsg,
    stack: error instanceof Error ? error.stack : undefined,
  });
  return res.status(500).set({ "Content-Type": "text/html" }).send(
    "<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load detective profile</p></body></html>"
  );  // ← Returns proper 500
}
```

### Location Route Handler (Development)

**File:** `server/index-dev.ts` (lines 61-115)

**Before → After:**

```typescript
// BEFORE
if (detectives.length === 0) {
  console.log('[SEO] No detectives found for location:', params);
  return attachViteTransform(vite, res, req, '');  // ← Falls back to SPA
}

// AFTER
if (!detectives || detectives.length === 0) {
  console.log('[SEO] No detectives found for location:', params);
  return res.status(404).set({ "Content-Type": "text/html" }).send(
    '<html><head><title>Location Not Found</title></head><body><h1>404 - No detectives in this location</h1></body></html>'
  );  // ← Returns proper 404
}
```

**Error handling:**

```typescript
// BEFORE
} catch (error) {
  console.error('[DEV-SEO Location] Error:', error);
  return attachViteTransform(vite, res, req, '');  // ← Falls back to SPA
}

// AFTER
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error('[DEV-SEO Location] CRITICAL ERROR:', {
    url: req.originalUrl,
    message: errorMsg,
    stack: error instanceof Error ? error.stack : undefined,
  });
  return res.status(500).set({ "Content-Type": "text/html" }).send(
    "<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load location detectives</p></body></html>"
  );  // ← Returns proper 500
}
```

---

## Import Updates

### server/lib/seo-injection.ts

```typescript
// BEFORE
import { db } from "../../db/index.ts";
import { detectives, reviews } from "../../shared/schema.ts";
import { eq, and } from "drizzle-orm";
import { avg, count } from "drizzle-orm";

// AFTER
import { db } from "../../db/index.ts";
import { detectives, reviews, services } from "../../shared/schema.ts";    // Added: services
import { eq, and, isNotNull } from "drizzle-orm";                          // Added: isNotNull
import { avg, count } from "drizzle-orm";
```

---

## Example Route Handler Structure (Final)

```typescript
app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, 
  async (req: Request, res: Response) => {
    
    try {
      // 1. Log request
      console.log("[SEO DEBUG] Profile route matched:", req.originalUrl);
      
      // 2. Extract and validate params
      const requestPath = req.path;
      const params = extractDetectiveRouteParams(requestPath);
      
      if (!params) {
        console.warn("[SEO] Profile params extraction failed");
        return attachViteTransform(vite, res, req, '');
      }
      
      console.log("[SEO] Attempting to fetch detective with params:", params);
      
      // 3. Query database
      const detective = await getDetectiveBySlugForSEO(
        params.country,
        params.state,
        params.city,
        params.slug
      );
      
      // 4. Handle not found
      if (!detective) {
        console.log("[SEO] Detective not found:", params);
        return res.status(404).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>Detective Not Found</title></head>" +
          "<body><h1>404 - Detective not found</h1></body></html>"
        );
      }
      
      console.log("[SEO] Detective found:", {
        businessName: detective.businessName,
        avgRating: detective.avgRating,
        reviewCount: detective.reviewCount,
      });
      
      // 5. Load template
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );
      
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      
      // 6. Inject SEO tags
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;
      template = injectSeoTags(template, detective, canonicalUrl);
      console.log(`[DEV-SEO] Successfully injected meta tags`);
      
      // 7. Transform with Vite
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      
      // 8. Send response
      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html" }).end(page);
      
    } catch (error) {
      // Error handling with full details
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DEV-SEO] CRITICAL ERROR in profile handler:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Return 500 with error HTML
      return res.status(500).set({ "Content-Type": "text/html" }).send(
        "<html><head><title>Server Error</title></head>" +
        "<body><h1>500 - Server Error</h1>" +
        "<p>Failed to load detective profile</p></body></html>"
      );
    }
  }
);
```

---

## HTTP Status Code Mapping

| URL | Status | Reason |
|-----|--------|--------|
| `/detectives/india/` | 200 | Location found, 10+ detectives |
| `/detectives/fakeplace/` | 404 | No detectives in location |
| `/detectives/india/mh/mumbai/john-doe/` | 200 | Detective found, SEO injected |
| `/detectives/india/mh/mumbai/no-exist/` | 404 | Detective not found |
| `/detectives/india/mh/mumbai/john-doe/` (DB error) | 500 | Database connection failed |

---

## Console Output Examples

### Success: Detective Profile Found

```
[SEO DEBUG] Profile route matched: /detectives/india/maharashtra/mumbai/john-doe/
[SEO] Attempting to fetch detective with params: {country: "india", state: "maharashtra", city: "mumbai", slug: "john-doe"}
[SEO] Fetching ratings for detective ID: abc-123
[SEO] Found 8 reviews with avg rating 4.30 for detective: John Doe Detective Services
[SEO] Detective found: {businessName: "John Doe Detective Services", avgRating: 4.3, reviewCount: 8}
[DEV-SEO] Successfully injected meta tags for detective: John Doe Detective Services
```

### Failure: Detective Not Found

```
[SEO DEBUG] Profile route matched: /detectives/india/maharashtra/mumbai/fake-detective/
[SEO] Attempting to fetch detective with params: {country: "india", state: "maharashtra", city: "mumbai", slug: "fake-detective"}
[SEO] Detective not found: {country: "india", state: "maharashtra", city: "mumbai", slug: "fake-detective"}
← Returns 404 HTML page
```

### Failure: Database Error

```
[SEO DEBUG] Profile route matched: /detectives/india/maharashtra/mumbai/john-doe/
[SEO] Attempting to fetch detective with params: {...}
[SEO] Fetching ratings for detective ID: abc-123
[SEO] ERROR fetching ratings for detective abc-123: {
  message: "Connection refused",
  stack: "Error: connect ECONNREFUSED 127.0.0.1:5432\n..."
}
[DEV-SEO] CRITICAL ERROR in profile handler: {
  url: "/detectives/india/maharashtra/mumbai/john-doe/",
  message: "Connection refused",
  stack: "..."
}
← Returns 500 HTML page
```

---

## Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| Query structure | WRONG (reviews.detectiveId) | CORRECT (services → reviews) |
| Detective not found | 200 SPA | **404** with error HTML |
| Database error | 200 SPA | **500** with error HTML |
| Error logging | Generic | **Detailed** with stack |
| Rating aggregation | Crashes | **Works** with nulls |
| Cache headers | Not set | Proper TTL |

