# Public Pages - Architecture & Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PUBLIC READERS                          │
│            (No Authentication Required)                      │
└──────────┬──────────────────────────────────────────────────┘
           │
           │ Browse: /pages/my-page-slug
           ↓
    ┌──────────────────┐
    │ Page View Route  │
    │ /pages/:slug     │
    └──────────┬───────┘
               │
               │ Fetch data
               ↓
    ┌──────────────────────────────────┐
    │ Public API Endpoint              │
    │ GET /api/public/pages/:slug      │
    │ (No Auth Required)               │
    └──────────┬───────────────────────┘
               │
               │ Query:
               │ - status = 'published' ✓
               │ - slug = requested slug
               │ - Include category
               │ - Include tags
               │ - Include SEO fields
               ↓
    ┌──────────────────────────────────┐
    │ Database Query                   │
    │                                  │
    │ SELECT ... FROM pages            │
    │ WHERE slug = $1                  │
    │ AND status = 'published'         │
    │ JOIN categories...               │
    │ JOIN page_tags...                │
    └──────────┬───────────────────────┘
               │
               │ Returns page data
               ↓
    ┌──────────────────────────────────┐
    │ Public Page Component            │
    │ Renders:                         │
    │ - Title + SEO meta tags          │
    │ - Breadcrumb nav                 │
    │ - Category info                  │
    │ - Content (HTML)                 │
    │ - Tags                           │
    │ - Publication date               │
    │ - Related links                  │
    └──────────────────────────────────┘
```

## Admin Publishing Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                    ADMIN EDITOR                              │
│          (Session Auth Required)                             │
└──────────┬───────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────────┐
    │                                                 │
    ▼                                                 ▼
Create Page Modal                              Open Existing Page
├─ Fill: Title                                 /admin/cms/pages/:id/edit
├─ Fill: Slug                                 │
├─ Select: Category                           ├─ All fields editable
├─ Select: Tags                               ├─ Preview mode
├─ Fill: Content                              ├─ "View Page" button (green)
├─ Fill: Meta Title                           │  └─ Shows if published
├─ Fill: Meta Description                     │  └─ Links to /pages/:slug
└─ Status: "draft"                            │  └─ Opens in new tab
    │                                         │
    │ Click "Save"                            │
    │                                         │
    ▼                                         │
Auto-redirect to editor ◄─────────────────────┘
/admin/cms/pages/:id/edit
│
├─ Form loads with page data
│
├─ Editor shows buttons:
│  ├─ Preview (toggle mode)
│  ├─ View Page (only if published) ← GREEN BUTTON
│  ├─ Save Draft
│  └─ Publish (or Update if published)
│
│ Edit content...
│
├─ Click "Publish" OR "Update"
│  │
│  ▼
│ PATCH /api/admin/pages/:id
│ {
│   title, slug, content, categoryId,
│   tagIds, metaTitle, metaDescription,
│   status: "published"
│ }
│  │
│  ├─ Validate (auth, fields, slug uniqueness)
│  │
│  ▼
│ Update database
│ UPDATE pages
│ SET status = 'published', ...
│ WHERE id = ?
│  │
│  ├─ Status changed: draft → published
│  │
│  ▼
│ Green "View Page" button now visible
│ (page.status === "published")
│  │
│  ├─ Click "View Page"
│  │
│  ▼
│ Opens /pages/:slug in new tab
│ (can now be shared publicly)
│  │
│  ▼
│ Public readers can access page
│ No auth required
│ Full layout with all metadata
```

## Request Flow Comparison

### Admin Reading Page
```
Admin Browser
    │
    ├─ GET /admin/cms/pages/:id/edit
    │   (Requires session auth)
    │   │
    │   ├─ GET /api/admin/pages/:id (auth required)
    │   │   Response: Draft page, all details
    │   │
    │   ├─ GET /api/admin/categories (auth required)
    │   │   Response: All categories
    │   │
    │   └─ GET /api/admin/tags (auth required)
    │       Response: All tags
    │
    └─ Renders editor with all fields
```

### Public Reading Page
```
Public Reader
    │
    ├─ GET /pages/my-page-slug
    │   (No auth required)
    │   │
    │   └─ GET /api/public/pages/my-page-slug (no auth)
    │       Response: Published page data only
    │
    └─ Renders published page with header/footer
```

## Database Access Control

```
┌───────────────────────────────────────┐
│         DATABASE (PostgreSQL)         │
│                                       │
│  Table: pages                         │
│  ├─ id                                │
│  ├─ title                             │
│  ├─ slug (unique)                     │
│  ├─ category_id (FK)                  │
│  ├─ content                           │
│  ├─ status (published|draft|archived) │
│  ├─ meta_title                        │
│  ├─ meta_description                  │
│  ├─ created_at                        │
│  └─ updated_at                        │
│                                       │
│  Constraints:                         │
│  ├─ UNIQUE(slug)                      │
│  ├─ CHECK(status IN (...))            │
│  └─ FK(category_id) → categories      │
│                                       │
└───────────────────────────────────────┘
         │
         ├──────────────────────────────────┐
         │                                  │
         ▼                                  ▼
    Admin Queries                   Public Queries
    (Authenticated)                 (No Auth)
    │                               │
    ├─ SELECT * FROM pages          ├─ SELECT * FROM pages
    │  (all statuses)               │  WHERE status='published'
    │                               │  AND slug = ?
    ├─ UPDATE pages                 │
    │  SET status='published'       └─ Only returns
    │                                 published pages
    ├─ INSERT/DELETE pages
    │
    └─ Full admin control
```

## Security Boundary

```
┌─────────────────────────────────────────────────────┐
│ AUTHENTICATED ZONE (Admin Only)                     │
│                                                     │
│ Routes: /admin/cms/*                                │
│ APIs: /api/admin/*                                  │
│ Access: Session-based                              │
│                                                     │
│ Operations:                                         │
│ ├─ Create pages (any status)                        │
│ ├─ Read all pages (any status)                      │
│ ├─ Update pages (any status)                        │
│ ├─ Delete pages                                     │
│ ├─ Edit draft/published/archived                    │
│ └─ Change status                                    │
│                                                     │
└─────────────────────────┬───────────────────────────┘
                          │
                    [Security Gate]
                     (Status Check)
                          │
                          │ Only published pages
                          │ pass through
                          │
┌─────────────────────────▼───────────────────────────┐
│ PUBLIC ZONE (Anyone Can Access)                     │
│                                                     │
│ Routes: /pages/*                                    │
│ APIs: /api/public/pages/*                           │
│ Access: No authentication                           │
│                                                     │
│ Operations:                                         │
│ ├─ View published pages                             │
│ ├─ Read all page details (SEO, content, etc)        │
│ ├─ No write access                                  │
│ └─ No status modification                           │
│                                                     │
│ Protection:                                         │
│ ├─ Database WHERE status='published'                │
│ ├─ No draft/archived pages accessible               │
│ ├─ Read-only (no mutations)                         │
│ └─ No admin features exposed                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Draft Protection Flow

```
Page Created
    │
    ├─ status = 'draft'
    │
    ├─ Try to access /pages/slug in browser
    │   ▼
    │ GET /api/public/pages/slug
    │   │
    │   ├─ Query: WHERE status='published'
    │   │   └─ Draft NOT in 'published'
    │   │
    │   └─ Response: 404 Not Found
    │
    └─ Admin editor shows preview
        (internal preview only)

                        │
                        │ Admin clicks "Publish"
                        │
                        ▼

Page Published
    │
    ├─ status = 'published'
    │
    ├─ Try to access /pages/slug in browser
    │   ▼
    │ GET /api/public/pages/slug
    │   │
    │   ├─ Query: WHERE status='published'
    │   │   └─ Published MATCHES
    │   │
    │   └─ Response: 200 OK + page data
    │
    └─ Public page accessible
        /pages/slug shows full layout
```

## Status Transitions

```
┌──────────┐
│  DRAFT   │ ← Default when creating page
└────┬─────┘
     │
     │ Click "Publish"
     │
     ▼
┌───────────────┐
│ PUBLISHED ◄┐  │ ← Publicly accessible at /pages/:slug
└───────┬───┘│  │
        │    │  │ Click "Update"
        │    └──┘
        │
        │ Click "Archive" or change to "draft"
        │
        ▼
┌──────────┐
│ ARCHIVED │ ← Hidden (404 if accessed)
└──────────┘


Database Constraints:
  ✓ Can transition: draft → published → archived
  ✓ Can transition: draft → archived
  ✓ Can transition: archived → draft
  
  ✓ Default: 'draft' when not specified
  ✓ Only published shows publicly
  ✓ Any status editable in admin
```

---

## Key Security Mechanisms

1. **Status Check** - WHERE status='published' in public API
2. **No Auth on Public API** - By design (intended to be public)
3. **Auth on Admin APIs** - Session + CSRF tokens required
4. **Read-Only Public** - No write operations on public endpoint
5. **Slug as ID** - Public uses slug, admin uses UUID (harder to guess)
6. **Separate Routes** - /api/public/* vs /api/admin/* completely separate
7. **No Leakage** - Admin details never returned in public responses

---

This architecture ensures:
- ✅ Drafted pages are completely private
- ✅ Published pages are fully public  
- ✅ Admin has complete control
- ✅ No sensitive data exposed
- ✅ Clean separation of concerns
- ✅ Scalable and maintainable
