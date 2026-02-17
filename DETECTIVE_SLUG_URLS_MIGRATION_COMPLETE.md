# Detective Profile Slug-Based URL Migration ✅

**Date**: February 13, 2026  
**Status**: COMPLETE  
**Build**: ✅ Passing (7.38s, 0 errors)  
**Dev Server**: ✅ Running on http://localhost:5000

---

## Overview

✅ **Completed Migration**: Detective profile URLs are now properly configured to use **slug-based routing** instead of UUID-based routing.

**Old URL Format**:
```
http://localhost:5000/p/23dac06d-afc2-41f3-b941-eb48b0641d45
```

**New URL Format** (Now Correct):
```
http://localhost:5000/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/
```

---

## What Changed

### 1. **Client-Side Routing** - [App.tsx](client/src/App.tsx#L218)

**Before**:
```tsx
<Route path="/p/:id" component={DetectivePublicPage} />
```

**After**:
```tsx
<Route path="/detectives/:country/:state/:city/:slug" component={DetectivePublicPage} />

{/* Legacy URL support - server redirects /p/:id to /detectives/{country}/{state}/{city}/{slug} */}
```

### 2. **API Client Methods** - [api.ts](client/src/lib/api.ts#L329)

**Added** `getBySlug()` method:
```typescript
getBySlug: async (country: string, state: string, city: string, slug: string): Promise<{ detective: Detective }> => {
  const response = await csrfFetch(`/api/detectives/${country}/${state}/${city}/${slug}`, {
    credentials: "include",
  });
  return handleResponse(response);
}
```

### 3. **React Query Hook** - [hooks.ts](client/src/lib/hooks.ts#L77)

**Added** `useDetectiveBySlug()` hook:
```typescript
export function useDetectiveBySlug(
  country: string | null | undefined, 
  state: string | null | undefined, 
  city: string | null | undefined, 
  slug: string | null | undefined
) {
  return useQuery({
    queryKey: ["detectives", "slug", country, state, city, slug],
    queryFn: () => api.detectives.getBySlug(country!, state!, city!, slug!),
    enabled: !!(country && state && city && slug),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
```

### 4. **Detective Page Component** - [detective.tsx](client/src/pages/detective.tsx#L23)

**Before**:
```tsx
const [, params] = useRoute("/p/:id");
const detectiveId = params?.id || null;
const { data: detectiveData } = useDetective(detectiveId);
const { data: servicesData } = useServicesByDetective(detectiveId);
```

**After**:
```tsx
const [, params] = useRoute("/detectives/:country/:state/:city/:slug");
const country = params?.country || null;
const state = params?.state || null;
const city = params?.city || null;
const slug = params?.slug || null;

const { data: detectiveData } = useDetectiveBySlug(country, state, city, slug);
const detective = detectiveData?.detective;
const { data: servicesData } = useServicesByDetective(detective?.id || null);
```

### 5. **Server-Side API Endpoint** - [routes.ts](server/routes.ts#L3097)

**Added** GET `/api/detectives/:country/:state/:city/:slug` endpoint:

```typescript
app.get("/api/detectives/:country/:state/:city/:slug", async (req: Request, res: Response) => {
  // 1. Find country by slug
  // 2. Find state by slug (if provided)
  // 3. Find city by slug (if provided)
  // 4. Find detective by slug + location criteria
  // 5. Mask sensitive fields (password, token, secret, apiKey)
  // 6. Return cached JSON response
});
```

**Features**:
- ✅ Validates country/state/city exist before querying detective
- ✅ Handles optional state/city (using '-' for missing values)
- ✅ Masks sensitive fields in response
- ✅ Returns 404 if detective not found
- ✅ Caches response using `sendCachedJson()`

---

## URL Structure Explanation

### Path Parameters

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| **:country** | slug | `india` | Country slug (SEO-friendly, lowercased) |
| **:state** | slug | `maharashtra` | State/Province slug |
| **:city** | slug | `mumbai` | City slug |
| **:slug** | slug | `aks-detective-agency-bengaluru` | Business slug (detective name + city) |

### Full URL Pattern

```
/detectives/{country-slug}/{state-slug}/{city-slug}/{business-slug}/
```

### Example URLs

| Detective | URL |
|-----------|-----|
| AKS Detective Agency (Mumbai, India) | `/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/` |
| Investigative Services (Los Angeles, USA) | `/detectives/united-states/california/los-angeles/investigative-services-la/` |
| Global Investigations (London, UK) | `/detectives/united-kingdom/england/london/global-investigations-london/` |

---

## How It Works - Flow Diagram

```
User visits URL: /detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/
                     ↓
         [Client-side Router (Wouter)]
                     ↓
         Extract params: {
           country: "india",
           state: "maharashtra",
           city: "mumbai",
           slug: "aks-detective-agency-bengaluru"
         }
                     ↓
         Call useDetectiveBySlug(country, state, city, slug)
                     ↓
         [React Query Hook]
                     ↓
         Fetch: GET /api/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/
                     ↓
         [Server API Endpoint]
                     ↓
         1. Find country by slug: "india" → countryId
         2. Find state by slug: "maharashtra" → stateId
         3. Find city by slug: "mumbai" → cityId
         4. Query detective where:
            - slug = "aks-detective-agency-bengaluru"
            - country = "India"
            - state = "Maharashtra"
            - city = "Mumbai"
                     ↓
         Return: { detective: {...} }
                     ↓
         Display detective profile page
```

---

## Legacy URL Support

The **server still supports the old `/p/:uuid` URLs** and automatically redirects them to the new slug-based URLs:

```typescript
// In server/routes.ts (lines 1314-1406)
app.get("/p/:detectiveId", async (req: Request, res: Response) => {
  // Look up detective by UUID
  // Fetch country/state/city slugs
  // Return 301 redirect to: /detectives/{country}/{state}/{city}/{slug}/
});
```

### Example Legacy Redirect

```
Old URL:  http://localhost:5000/p/23dac06d-afc2-41f3-b941-eb48b0641d45
          ↓ [Server 301 Redirect]
New URL:  http://localhost:5000/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/
```

---

## Database Schema Requirements

Your database must have these columns populated:

### `detectives` table
- ✅ `id` - Primary Key (UUID)
- ✅ `slug` - Business slug (nullable, auto-generated from businessName + city)
- ✅ `businessName` - Detective agency name
- ✅ `country` - Country code (e.g., "IN", "US")
- ✅ `state` - State/Province name (e.g., "Maharashtra")
- ✅ `city` - City name (e.g., "Mumbai")

### `countries` table
- ✅ `code` - Country code (e.g., "IN")
- ✅ `slug` - Country slug (e.g., "india")

### `states` table
- ✅ `name` - State name (e.g., "Maharashtra")
- ✅ `slug` - State slug (e.g., "maharashtra")
- ✅ `countryId` - Foreign key to countries

### `cities` table
- ✅ `name` - City name (e.g., "Mumbai")
- ✅ `slug` - City slug (e.g., "mumbai")
- ✅ `stateId` - Foreign key to states

---

## Caching Strategy

Detective profile pages are **aggressively cached** for performance:

```typescript
// Client-side React Query cache
staleTime: 60 * 1000,      // 1 minute before refetch
gcTime: 5 * 60 * 1000,     // Keep in memory for 5 minutes

// Server-side HTTP cache (Cache-Control)
sendCachedJson(response)   // Caches with appropriate headers
```

**Why cache?**
- ✅ International SEO optimization (fast page loads)
- ✅ Reduced database queries for popular detectives
- ✅ Better Core Web Vitals (LCP, CLS)

---

## Testing the Implementation

### 1. **Server Responds to Slug-Based URLs**

```bash
# Test API endpoint
curl "http://localhost:5000/api/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/"
```

Expected response:
```json
{
  "detective": {
    "id": "23dac06d-afc2-41f3-b941-eb48b0641d45",
    "slug": "aks-detective-agency-bengaluru",
    "businessName": "AKS Detective Agency",
    "country": "IN",
    "state": "Maharashtra",
    "city": "Mumbai",
    ...
  }
}
```

### 2. **Client-Side Routing Works**

Navigate in browser:
```
http://localhost:5000/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/
```

Expected behavior:
- ✅ Page loads with detective profile
- ✅ Services displayed
- ✅ No console errors
- ✅ SEO metadata in page head

### 3. **Legacy URL Redirect Works**

Navigate in browser:
```
http://localhost:5000/p/23dac06d-afc2-41f3-b941-eb48b0641d45
```

Expected behavior:
- ✅ Browser redirects to: `/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/`
- ✅ Shows detective profile
- ✅ Server returns HTTP 301 in network tab

### 4. **All Error States Handled**

```
http://localhost:5000/detectives/india/maharashtra/mumbai/nonexistent-agency/
```

Expected behavior:
- ✅ Shows `<NotFoundFallback />` with "Detective Not Found" message
- ✅ Provides "Go to Home" button
- ✅ No JavaScript errors in console

---

## SEO Benefits

✅ **Slug-based URLs provide SEO advantages**:

1. **Keyword-rich URLs**
   - Contains country, state, city, business name
   - Search engines understand location context
   
2. **Better Click-Through Rate (CTR)**
   - Users see the detective name in SERP preview
   - Location signals improve local search rankings

3. **Mobile-Friendly**
   - Shorter URLs (domain relative)
   - Better readability in mobile search results

4. **Canonical URLs**
   - Slug-based URLs are the canonical form
   - Legacy UUIDs redirect with 301 status
   - No duplicate content issues

### Example SERPs

```
Title: AKS Detective Agency - Mumbai Private Investigator
URL: askdetectives.com/detectives/india/maharashtra/mumbai/aks-detective-agency-bengaluru/
Description: Find trusted private detectives in Mumbai, Maharashtra...
```

---

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| [client/src/App.tsx](client/src/App.tsx#L218) | Updated route from `/p/:id` to `/detectives/:country/:state/:city/:slug` | +1 comment |
| [client/src/lib/api.ts](client/src/lib/api.ts#L329) | Added `getBySlug()` method | +7 |
| [client/src/lib/hooks.ts](client/src/lib/hooks.ts#L77) | Added `useDetectiveBySlug()` hook | +16 |
| [client/src/pages/detective.tsx](client/src/pages/detective.tsx#L23) | Updated to extract and use slug params | +9 |
| [server/routes.ts](server/routes.ts#L3097) | Added `GET /api/detectives/:country/:state/:city/:slug` endpoint | +110 |

---

## Deployment Checklist

- [ ] Verify all detective profiles have `slug` field populated
- [ ] Check country/state/city `slug` fields match URL-safe format
- [ ] Test 10+ detective URLs in staging environment
- [ ] Verify legacy `/p/:uuid` redirects work (server-side)
- [ ] Check Google Search Console for redirect crawl stats
- [ ] Update sitemap.xml to include new slug-based URLs
- [ ] Monitor Core Web Vitals after deployment
- [ ] Add 301 redirect monitoring to analytics

---

## Summary

✅ **Detective URLs now follow your configured format**:
```
https://www.askdetectives.com/detectives/:country/:state/:city/:business-slug/
```

✅ **All layers updated**:
- Client-side routing (Wouter)
- API client methods (React Query)
- Server-side endpoints (Express)
- Error handling (NotFoundFallback)
- SEO optimization (slug-based URLs)

✅ **Backward compatibility maintained**:
- Old UUID URLs still work via 301 redirects
- Existing links won't break
- Gradual migration path for users

✅ **Build verified**: 0 errors, 7.38 seconds  
✅ **Dev server running**: http://localhost:5000

---

**Ready to test!** Navigate to your detective pages and confirm they load with the new slug-based URLs. 🚀

