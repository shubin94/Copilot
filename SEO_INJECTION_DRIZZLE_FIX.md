# SEO Injection - Drizzle ORM Error Fix & Enhanced Error Handling

**Date:** February 23, 2026  
**Status:** ✅ Fixed and deployed

---

## Problem Summary

### Symptom
Profile SEO handler was executing and logging `[SEO DEBUG] Profile route matched:`, but then throwing a **Drizzle ORM error** preventing detective data retrieval:

```
TypeError: Cannot convert undefined or null to object
at Function.entries (<anonymous>)
at orderSelectedFields (node_modules/src/utils.ts:77:16)
```

### Root Cause
The SEO injection function for detective profiles was attempting to query the `reviews` table with:

```typescript
// ❌ BROKEN QUERY
const ratingData = await db.select({
  avgRating: avg(reviews.rating),
  count: count(reviews.id),
}).from(reviews)
  .where(eq(reviews.detectiveId, detective.id));  // ← reviews.detectiveId does NOT exist!
```

**The problem:** The `reviews` table does NOT have a `detectiveId` column. It only has:
- `serviceId` - references services
- `userId` - references users
- `orderId` - for billing tracking
- `rating`, `comment`, `createdAt`, etc.

Relationship chain: **Detective → Services → Reviews**

When Drizzle tried to access `reviews.detectiveId` (which is undefined), it threw an error trying to process null/undefined properties.

---

## Database Schema Analysis

### Reviews Table (WRONG)
```typescript
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id),  // ← Join point
  userId: varchar("user_id").notNull().references(() => users.id),
  orderId: varchar("order_id"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ❌ NO detectiveId column!
});
```

### Services Table (Bridge)
```typescript
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  detectiveId: varchar("detective_id").notNull()    // ← Detective link
    .references(() => detectives.id, { onDelete: "cascade" }),
  // ... other fields
  // Each service belongs to ONE detective
});
```

### Detectives Table (Parent)
```typescript
export const detectives = pgTable("detectives", {
  id: varchar("id").primaryKey(),
  // ... detective fields
  // Has many services
});
```

---

## Solution Applied

### 1. Fixed Drizzle Query (server/lib/seo-injection.ts)

#### Before (Broken)
```typescript
// ❌ BROKEN - reviews.detectiveId doesn't exist
const ratingData = await db.select({
  avgRating: avg(reviews.rating),
  count: count(reviews.id),
}).from(reviews)
  .where(eq(reviews.detectiveId, detective.id));  // Error here!
```

#### After (Fixed)
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
      eq(services.detectiveId, detective.id),     // ← The detective filter
      isNotNull(reviews.rating),                  // ← Null safety
      eq(reviews.isPublished, true)               // ← Only published reviews
    )
  );

// Process results with better error handling
if (ratingData.length > 0 && ratingData[0]) {
  const data = ratingData[0];
  avgRating = data.avgRating ? Number(data.avgRating).toFixed(2) : 0;
  reviewCount = data.reviewCount ? Number(data.reviewCount) : 0;
  console.log(`[SEO] Found ${reviewCount} reviews with avg rating ${avgRating}`);
}
```

**Key improvements:**
- ✅ Joins through services (the correct relationship)
- ✅ Filters by `services.detectiveId` (not non-existent reviews field)
- ✅ Adds null safety checks
- ✅ Only counts published reviews
- ✅ Better logging with data retrieved

### 2. Updated Error Handling

#### Before (Silent Fallback)
```typescript
try {
  const ratingData = await db.select({...}).from(reviews)...;
  // handle data
} catch (error) {
  console.warn("[SEO] Failed to fetch ratings:", error);  // ← Vague log
  // Silently continues with avgRating = 0
}
```

#### After (Explicit Error Reporting)
```typescript
try {
  const ratingData = await db.select({...}).from(services).innerJoin(reviews)...;
  // handle data
  if (ratingData.length > 0 && ratingData[0]) {
    avgRating = data.avgRating ? Number(data.avgRating).toFixed(2) : 0;
    reviewCount = data.reviewCount ? Number(data.reviewCount) : 0;
    console.log(`[SEO] Found ${reviewCount} reviews with avg rating ${avgRating}`);
  } else {
    console.log(`[SEO] No published reviews found`);
  }
} catch (error) {
  console.error(`[SEO] ERROR fetching ratings for detective ${detective.id}:`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  // Continue with avgRating = 0 (non-critical feature)
}
```

---

## Route Handler Improvements

### Detective Profile Handler (index-dev.ts & index-prod.ts)

#### Changes
1. **Return 404 when detective not found** (not SPA fallback)
2. **Return 500 on database errors** (not SPA fallback)
3. **Enhanced logging with extracted params**
4. **Explicit detective data verification before injection**

#### Before
```typescript
// If error: silently fallback to SPA
try {
  const detective = await getDetectiveBySlugForSEO(...);
  
  if (!detective) {
    console.log('[SEO] Detective not found');
    return serveIndexHtmlWithSeo(res, ...)  // ← SPA fallback
  }
  // ... inject and serve
} catch (error) {
  console.error('[DEV-SEO] Error:', error);
  return attachViteTransform(vite, res, req, '');  // ← SPA fallback
}
```

#### After
```typescript
try {
  console.log("[SEO] Attempting to fetch detective with params:", {
    country, state, city, slug
  });
  
  const detective = await getDetectiveBySlugForSEO(...);
  
  if (!detective) {
    console.log("[SEO] Detective not found:", params);
    return res.status(404).set({ "Content-Type": "text/html" }).send(
      "<html>...<h1>404 - Detective not found</h1>...</html>"
    );
  }
  
  console.log("[SEO] Detective found:", {
    businessName: detective.businessName,
    avgRating: detective.avgRating,
    reviewCount: detective.reviewCount,
  });
  
  // ... inject and serve
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error('[DEV-SEO] CRITICAL ERROR in profile handler:', {
    url: req.originalUrl,
    message: errorMsg,
    stack: error instanceof Error ? error.stack : undefined,
  });
  return res.status(500).set({ "Content-Type": "text/html" }).send(
    "<html>...<h1>500 - Server Error</h1>...</html>"
  );
}
```

### Location Listing Handler (index-dev.ts & index-prod.ts)

#### Changes
1. **Return 404 when no detectives found** (not SPA fallback with empty state)
2. **Return 500 on database errors** (not SPA fallback)
3. **More explicit logging**

#### Before
```typescript
if (detectives.length === 0) {
  console.log('[SEO] No detectives found for location');
  return serveIndexHtmlWithSeo(res, ...)  // ← SPA fallback
}
```

#### After
```typescript
if (!detectives || detectives.length === 0) {
  console.log('[SEO] No detectives found for location:', params);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(
    '<html><head><title>Location Not Found</title></head><body><h1>404 - No detectives in this location</h1></body></html>'
  );
}
```

---

## Import Updates

### server/lib/seo-injection.ts
```typescript
// Before
import { db } from "../../db/index.ts";
import { detectives, reviews } from "../../shared/schema.ts";
import { eq, and } from "drizzle-orm";
import { avg, count } from "drizzle-orm";

// After
import { db } from "../../db/index.ts";
import { detectives, reviews, services } from "../../shared/schema.ts";  // ← Added services
import { eq, and, isNotNull } from "drizzle-orm";                        // ← Added isNotNull
import { avg, count } from "drizzle-orm";
```

---

## HTTP Status Code Mapping

| Scenario | Before | After |
|---|---|---|
| Detective not found | 200 SPA | **404** |
| Location has 0 detectives | 200 SPA | **404** |
| Database query error | 200 SPA | **500** |
| Successful SEO injection | 200 HTML | **200** HTML |

---

## Logging Format

### Debug/Info Logs (Success Path)
```
[SEO] Fetching ratings for detective ID: xyz-123
[SEO] Found 15 reviews with avg rating 4.50 for detective: John Doe Detective Services
[SEO] Detective found: {businessName: "John Doe", avgRating: 4.5, reviewCount: 15}
[DEV-SEO] Successfully injected meta tags for detective: John Doe Detective Services
```

### Warning/Error Logs (Failure Path)
```
[SEO] Profile params extraction failed for: /detectives/india/mh/mumbai/invalid
[SEO] Detective not found: {country: "india", state: "maharashtra", city: "mumbai", slug: "john-doe"}
[DEV-SEO] CRITICAL ERROR in profile handler: {
  url: "/detectives/india/maharashtra/mumbai/john-doe/",
  message: "Connection refused",
  stack: "Error: ... at ..."
}
```

---

## Testing Verification

### Test 1: Valid Detective Profile
```bash
curl http://localhost:5000/detectives/india/maharashtra/mumbai/john-doe/
```

**Expected console output:**
```
[SEO DEBUG] Profile route matched: /detectives/india/maharashtra/mumbai/john-doe/
[SEO] Attempting to fetch detective with params: {...}
[SEO] Fetching ratings for detective ID: abc-123
[SEO] Found 10 reviews with avg rating 4.2
[SEO] Detective found: {businessName: "John Doe", avgRating: 4.2, reviewCount: 10}
[DEV-SEO] Successfully injected meta tags for detective: John Doe
```

**Expected response:**
- Status: **200 OK**
- Body: Full HTML with meta tags injected

### Test 2: Non-existent Detective
```bash
curl http://localhost:5000/detectives/india/maharashtra/mumbai/non-existent/
```

**Expected response:**
- Status: **404 Not Found**
- Body: Simple 404 HTML page

### Test 3: Valid Location Listing
```bash
curl http://localhost:5000/detectives/india/
```

**Expected response:**
- Status: **200 OK**
- Body: HTML with location SEO tags + list of detectives

### Test 4: Empty Location
```bash
curl http://localhost:5000/detectives/fakecountry/
```

**Expected response:**
- Status: **404 Not Found**
- Body: Simple 404 HTML page

---

## Files Modified

1. **server/lib/seo-injection.ts**
   - Added `services` import
   - Fixed Drizzle query to join through services
   - Enhanced error handling and logging
   - Better null-safety

2. **server/index-dev.ts**
   - Profile handler: Return 404/500 instead of SPA fallback
   - Location handler: Return 404/500 instead of SPA fallback
   - Enhanced params validation logging
   - Better error reporting with stack traces

3. **server/index-prod.ts**
   - Same changes as dev for consistency
   - Production-grade error responses

---

## Backward Compatibility

✅ No breaking changes to:
- Route patterns (still use same regex)
- SEO injection markers (still same TitlePoint, MetaPoint, JSONLDPoint)
- API contracts (detective model unchanged)
- Database queries (only query logic changed, not data model)

✅ Improvements to:
- Error reporting (now explicit instead of silent)
- HTTP semantics (proper status codes)
- Debuggability (better logging)
- Reliability (null-safe query)

---

## Future Enhancements

1. **Caching detective ratings** - Store avgRating in denormalized column
2. **Async detective search** - Search across all names, not just slug
3. **Location fallback** - If city not found, try state; if state not found, try country
4. **Reviews aggregation** - Include review count in service listing
5. **Rating middleware** - Pre-compute and cache ratings daily

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| SEO injection execution | ✅ Starting, ❌ crashes | ✅ Complete |
| Error visibility | ❌ Silent failures | ✅ Explicit 404/500 |
| Database logic | ❌ Invalid query | ✅ Correct join |
| Detective rating fetch | ❌ Always null | ✅ Working |
| Debugging difficulty | ❌ Hard | ✅ Easy with logs |
| HTTP semantics | ❌ Wrong (200 for errors) | ✅ Correct (404/500) |

**Result:** SEO injection now fully functional with proper error handling and reporting.
