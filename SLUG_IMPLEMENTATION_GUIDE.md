# Service Slug Implementation Guide

## Overview

This implementation converts service URLs from UUID-based (`/service/{id}`) to slug-based SEO-friendly URLs (`/service/{country}/{state}/{city}/{service-slug}`).

## Changes Made

### 1. Database Schema (shared/schema.ts)
- Added `slug: text("slug").notNull().unique()` field to services table
- Added unique index: `services_slug_unique`

### 2. Server Endpoints (server/routes.ts)
- **GET /api/services/by-slug/:slug** - New simple slug lookup endpoint
  - Returns: `{ service, detective, avgRating, reviewCount }`
  - Handles both public and preview mode
  - Validates service completeness before returning
  - Increments view count on access

- **GET /api/services/:country/:state/:city/:slug** - Location-aware slug lookup
  - Fetches service by slug + detective location match
  - Used for breadcrumb/location-aware navigation

### 3. Client-Side (client/src/)
- **lib/slug-utils.ts** - Slug generation and URL building utilities
  - `generateSlug(text)` - Converts text to URL-safe format
  - `buildServiceUrl()` - Constructs full service URLs
  - `formatLocationPart()` - Formats location components

- **App.tsx** - Updated routing
  - Changed from: `/service/:id`
  - Changed to: `/service/:country/:state/:city/:slug`

- **pages/detective-profile.tsx** - Updated to use slug-based routing
  - Uses `useServiceBySlug` hook instead of `useService`
  - Extracts location params from URL

- **components/home/service-card.tsx** - Updated to support slug-based URLs
  - Uses `buildServiceUrl` for link construction
  - Falls back to UUID-based URLs for services without slugs

- **lib/hooks.ts** - New hook
  - `useServiceBySlug(slug, preview)` - React Query hook for slug-based fetching

- **lib/api.ts** - New API method
  - `services.getBySlug(slug, options)` - Client for slug endpoint

## How to Apply

### 1. Run Database Migration
```bash
# Method 1: Using the migration script
tsx server/scripts/apply-slug-migration.ts

# Method 2: Manual migration (if needed)
# ALTER TABLE services ADD COLUMN IF NOT EXISTS slug text UNIQUE;
# CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique ON services(slug) WHERE slug IS NOT NULL;
```

### 2. Populate Existing Services with Slugs
```bash
# Automatically done by apply-slug-migration.ts, but can be run separately:
tsx server/scripts/populate-service-slugs.ts
```

### 3. Restart Application
```bash
npm run dev  # or your normal startup command
```

## Slug Generation Rules

Slugs are auto-generated from service titles:
1. Convert to lowercase
2. Remove special characters (keep alphanumeric, spaces, hyphens)
3. Replace spaces with hyphens
4. Remove leading/trailing hyphens
5. Handle duplicates by appending numeric suffix

### Examples
- "Background Check Service" → `background-check-service`
- "Private Investigation (24/7)" → `private-investigation-247`
- "Deep Web Search--Expert" → `deep-web-search-expert`

## Backward Compatibility

**Service cards and links support both formats:**
- If service has slug: Uses new slug-based URL
- If service lacks slug: Falls back to UUID-based URL
- Graceful degradation ensures no broken links

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] All existing services get slugs populated
- [ ] Service page loads via slug URL: `/service/{country}/{state}/{city}/{slug}`
- [ ] Service page loads via ID fallback: `/service/{id}` (if slug not available)
- [ ] Service ratings display correctly
- [ ] Service view count increments
- [ ] Breadcrumbs show correct location hierarchy
- [ ] SEO meta tags use slug-based URLs
- [ ] Search results link to correct service details

## API Response Examples

### GET /api/services/by-slug/background-check-service
```json
{
  "service": {
    "id": "uuid-123",
    "title": "Background Check Service",
    "slug": "background-check-service",
    "description": "...",
    "basePrice": "49.99",
    ...
  },
  "detective": {
    "id": "uuid-456",
    "businessName": "Detective Agency",
    ...
  },
  "avgRating": 4.5,
  "reviewCount": 12
}
```

## Troubleshooting

### Slug Column Doesn't Exist
```sql
-- Check if column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'services' AND column_name = 'slug';

-- Add if missing
ALTER TABLE services ADD COLUMN slug text UNIQUE;
```

### Duplicate Slug Error
The migration script handles duplicates automatically by appending numeric suffixes.

### Services Missing Slugs
Run the population script:
```bash
tsx server/scripts/populate-service-slugs.ts
```

## Future Enhancements

1. Custom slug editing in detective dashboard
2. Slug history/redirects for changed slugs
3. Slug validation in service creation form
4. Automated sitemap generation with slug URLs
