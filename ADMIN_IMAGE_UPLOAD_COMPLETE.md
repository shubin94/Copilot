# Admin Image Upload Feature - Complete Implementation

## Overview
Implemented a feature allowing administrators to upload and manage hero background and features section images through the admin settings page. Images are stored in the database and displayed dynamically on the home page.

## Implementation Summary

### ✅ All Tasks Completed

1. **Database Schema Updates** - [shared/schema.ts](shared/schema.ts)
   - Added `heroBackgroundImage` field to `siteSettings` table
   - Added `featuresImage` field to `siteSettings` table
   - Updated `updateSiteSettingsSchema` to include new fields

2. **Database Migration** - [server/scripts/add-hero-features-images.ts](server/scripts/add-hero-features-images.ts)
   - Created migration script to add columns
   - Successfully executed: `npx tsx server/scripts/add-hero-features-images.ts`
   - ✓ Added `hero_background_image` column
   - ✓ Added `features_image` column

3. **Backend API Routes** - [server/routes.ts](server/routes.ts)
   - Enhanced existing `/api/admin/site-settings` PATCH endpoint
   - Added upload handling for `heroBackgroundImage` (data URL → file upload)
   - Added upload handling for `featuresImage` (data URL → file upload)
   - Automatic cleanup of old images when replaced

4. **Storage Functions** - No changes needed
   - Existing `getSiteSettings()` function already returns all site settings
   - Existing `upsertSiteSettings()` function handles all fields

5. **Admin UI** - [client/src/pages/admin/settings.tsx](client/src/pages/admin/settings.tsx)
   - Added new "Home Page Images" tab
   - Two upload cards:
     * Hero Background Image uploader
     * Features Section Image uploader
   - Reuses existing `LogoUploadCard` component pattern
   - Preview, upload, and clear functionality
   - Image validation (file type, max 2MB)
   - Save/Reset buttons

6. **Frontend Display** - Updated home page components
   - **Hero Component** [client/src/components/home/hero.tsx](client/src/components/home/hero.tsx):
     * Fetches site settings using `useSiteSettings()` hook
     * Uses `heroBackgroundImage` if uploaded
     * Falls back to default hardcoded image
   
   - **Home Page** [client/src/pages/home.tsx](client/src/pages/home.tsx):
     * Fetches site settings using `useSiteSettings()` hook
     * Uses `featuresImage` if uploaded
     * Falls back to `/pub.png` default image

## How to Use

### For Administrators:

1. **Access Admin Settings:**
   - Navigate to `/admin/settings` (requires admin role)
   - Click on "Home Page Images" tab

2. **Upload Hero Background:**
   - Click "Hero Background Image" upload area
   - Select image (PNG, JPG, SVG, max 2MB)
   - Recommended: 1920x600px landscape image
   - Preview appears immediately

3. **Upload Features Image:**
   - Click "Features Section Image" upload area
   - Select image (PNG, JPG, SVG, max 2MB)
   - Recommended: 800x600px portrait/square image
   - Preview appears immediately

4. **Save Changes:**
   - Click "Save Images" button
   - Images are uploaded and saved to database
   - Home page updates automatically

5. **Reset/Clear:**
   - Use "Reset" to discard unsaved changes
   - Use "X" button on previews to clear individual images
   - Saves as null to revert to default images

### Technical Details:

**Image Upload Flow:**
1. User selects image file
2. Converted to data URL (base64) for preview
3. On save, data URL sent to backend
4. Backend uploads to cloud storage (Cloudinary)
5. Cloud URL saved to database
6. Old images automatically deleted
7. Frontend fetches and displays new URL

**Database Schema:**
```sql
ALTER TABLE site_settings 
ADD COLUMN hero_background_image TEXT,
ADD COLUMN features_image TEXT;
```

**API Endpoint:**
```
PATCH /api/admin/site-settings
Authorization: Admin role required
Body: {
  heroBackgroundImage?: string (data URL or null),
  featuresImage?: string (data URL or null)
}
```

**Frontend Hooks:**
```typescript
const { data: siteData } = useSiteSettings();
const heroImage = siteData?.settings?.heroBackgroundImage;
const featuresImage = siteData?.settings?.featuresImage;
```

## File Changes Summary

### Modified Files:
1. `shared/schema.ts` - Added 2 fields to siteSettings table and schema
2. `server/routes.ts` - Added upload handling for 2 new image fields
3. `client/src/pages/admin/settings.tsx` - Added Home Page Images tab with 2 uploaders
4. `client/src/components/home/hero.tsx` - Added heroBackgroundImage fetch and display
5. `client/src/pages/home.tsx` - Added featuresImage fetch and display

### New Files:
1. `server/scripts/add-hero-features-images.ts` - Migration script (already executed)

## Testing Checklist

- [x] Migration executed successfully
- [x] Schema updated with new fields
- [x] API routes accept and process image uploads
- [x] Admin UI shows upload interface
- [x] Images can be uploaded and previewed
- [x] Changes save to database
- [x] Home page displays uploaded hero background
- [x] Home page displays uploaded features image
- [x] Fallback to defaults when no images uploaded
- [x] Old images deleted when replaced

## Next Steps (Optional Enhancements)

1. Add image cropping/resizing UI before upload
2. Add multiple hero backgrounds with slideshow
3. Add preview of home page in admin settings
4. Add validation for image dimensions
5. Add batch upload for multiple images
6. Add image optimization on server side

## Notes

- Images stored in cloud storage (Cloudinary) via existing upload infrastructure
- Database stores URLs, not binary data
- Existing logo upload pattern reused for consistency
- No breaking changes - feature is additive only
- Fallback defaults ensure home page always has images
- All validation and error handling in place
