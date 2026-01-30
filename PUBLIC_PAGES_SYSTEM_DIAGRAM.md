# Public Pages - System Diagram

## Complete System Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          YOUR APPLICATION                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────┐                      ┌──────────────────┐         │
│  │  PUBLIC ZONE     │                      │   ADMIN ZONE     │         │
│  │  (Anyone)        │                      │  (Authenticated) │         │
│  └────────┬─────────┘                      └────────┬─────────┘         │
│           │                                         │                     │
│           │                                         │                     │
│  Route: /pages/:slug                     Route: /admin/cms/pages/:id/edit │
│           │                                         │                     │
│           ▼                                         ▼                     │
│  ┌────────────────────────┐          ┌──────────────────────────┐       │
│  │ Public Page Viewer     │          │ Page Editor              │       │
│  │ (page-view.tsx)        │          │ (page-edit.tsx)          │       │
│  │                        │          │                          │       │
│  │ - SEO Meta Tags        │          │ - Edit Form              │       │
│  │ - Breadcrumbs          │          │ - Preview Mode           │       │
│  │ - Content              │          │ - "View Page" Button ◄───┼──────┼─┐
│  │ - Category/Tags        │          │ - Publish/Update Button  │       │ │
│  │ - Publication Date     │          │ - Status Indicator       │       │ │
│  │ - Related Links        │          └──────────────────────────┘       │ │
│  │ - 404 Handling         │                                              │ │
│  └────────┬───────────────┘                                              │ │
│           │                                                              │ │
│           │ Fetch                                                        │ │
│           ▼                                                              │ │
│  ┌────────────────────────┐                                              │ │
│  │ Public API             │                                              │ │
│  │ /api/public/pages/:slug│                                              │ │
│  │                        │                                              │ │
│  │ - No Auth Required     │                                              │ │
│  │ - Read-Only            │                                              │ │
│  │ - Returns Published ✓  │                                              │ │
│  │ - Returns Draft ✗ 404  │                                              │ │
│  └────────┬───────────────┘                                              │ │
│           │                                                              │ │
│           │ Query                                                        │ │
│           ▼                                                              │ │
│  ┌────────────────────────────────────┐                                 │ │
│  │ Database Query                     │                                 │ │
│  │                                    │                                 │ │
│  │ SELECT * FROM pages                │                                 │ │
│  │ WHERE slug = ? AND status = 'pub'  │ ← SAFETY GATE ✓               │ │
│  │ LEFT JOIN categories               │                                 │ │
│  │ INNER JOIN page_tags, tags         │                                 │ │
│  └────────┬────────────────────────────┘                                 │ │
│           │                                                              │ │
│           │ Result                                                       │ │
│           ▼                                                              │ │
│  ┌────────────────────────────────────┐                                 │ │
│  │ Published Page Data                │                                 │ │
│  │                                    │                                 │ │
│  │ {                                  │                                 │ │
│  │   id: uuid,                        │                                 │ │
│  │   title: string,                   │                                 │ │
│  │   slug: string,                    │                                 │ │
│  │   content: html,                   │                                 │ │
│  │   status: "published",             │                                 │ │
│  │   metaTitle: string,               │                                 │ │
│  │   metaDescription: string,         │                                 │ │
│  │   category: {...},                 │                                 │ │
│  │   tags: [...]                      │                                 │ │
│  │ }                                  │                                 │ │
│  └────────────────────────────────────┘                                 │ │
│                                                                           │ │
│  [Renders in public viewer]              [Opens in new tab] ──────────────┘
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Workflow Timeline

```
Admin                              System                        Public
│                                   │                            │
├─ Creates page                     │                            │
│  (title, content, etc)           │                            │
│                                   │                            │
├─ Saves (draft)                    │                            │
│  │                                │                            │
│  ├─ POST /api/admin/pages ────────┤                            │
│  │                                │                            │
│  │                                ├─ Inserts row              │
│  │                                │  status='draft'            │
│  │                                │                            │
│  └─ Auto-redirect to editor ◄────┤                            │
│     /admin/cms/pages/:id/edit    │                            │
│                                   │                            │
├─ Edits content                    │                            │
│  (changes title, slug, SEO, etc) │                            │
│                                   │                            │
├─ Clicks "Publish"                 │                            │
│  │                                │                            │
│  ├─ PATCH /api/admin/pages/:id ──┤                            │
│  │  status: 'published'          │                            │
│  │                                │                            │
│  │                                ├─ Updates row              │
│  │                                │  status='published' ✓     │
│  │                                │                            │
│  └◄─ Success response             │                            │
│                                   │                            │
│ *** "View Page" button appears *** │                            │
│ (was hidden for draft)            │                            │
│                                   │                            │
├─ Clicks "View Page"               │                            │
│  (green button, opens in new tab)│                            │
│  │                                │                            │
│  ├─ Opens /pages/page-slug ───────┼───────────────┐           │
│  │                                │              │            │
│  │                                ├─ Fetch       │            │
│  │                                │  /api/public │            │
│  │                                │  /pages/     │            │
│  │                                │  page-slug   │            │
│  │                                │              │            │
│  │                                ├─ Query DB    │            │
│  │                                │  WHERE status│            │
│  │                                │  = 'pub' ✓  │            │
│  │                                │              │            │
│  │                                ├─ Return page │            │
│  │                                │  with SEO,   │            │
│  │                                │  category,   │            │
│  │                                │  tags        │            │
│  │                                │              │            │
│  └──────────────────────────────────────────────┤            │
│                                                  │            │
│                                                  ├─ Render   │
│                                                  │  in page  │
│                                                  │  viewer   │
│                                                  │            │
│                                                  └───────────→
│                                                               │
│                                                    Page visible!
│                                                    SEO tags applied
│                                                    Share URL available
│                                                               │
│ Admin can still                                              │
│ edit page (click                                  ← Readers see
│ edit button in list)                               published content
│                                                               │
├─ Click eye icon                   │                          │
│ /admin/cms/pages              ────┤                          │
│ (open editor again)            │                          │
│                                  │                          │
├─ Make more edits                 │                          │
│                                  │                          │
├─ Click "Update" (not publish)    │                          │
│  │                               │                          │
│  ├─ PATCH /api/admin/pages/:id ─┤                          │
│  │  (status still 'published')  │                          │
│  │                               │                          │
│  │                              ├─ Updates immediately    │
│  │                              │  Live page changes      │
│  │                               │                          │
│  └◄─ Success                     │                          │
│                                  │                          │
│ Public page updates              │                          │
│ (no downtime)                    │                          │
│                                  │                          ├─ Refresh page
│                                  │                          │ New content visible
│                                  │                          │
└──────────────────────────────────────────────────────────────┘
```

## Security Boundary Visualization

```
┌───────────────────────────────────────────────────────────┐
│                  APPLICATION BOUNDARY                     │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐          ┌─────────────────────┐ │
│  │  ADMIN ZONE      │          │   PUBLIC ZONE       │ │
│  │  (Protected)     │          │  (Open Access)      │ │
│  │                  │          │                     │ │
│  │  /admin/cms/*    │          │  /pages/*           │ │
│  │  /api/admin/*    │          │  /api/public/*      │ │
│  │                  │          │                     │ │
│  │  Requires:       │          │  No Auth Required   │ │
│  │  ✓ Session       │          │  ✓ Public Available │ │
│  │  ✓ User Role     │          │  ✓ Read-Only        │ │
│  │  ✓ CSRF Token    │          │  ✓ Safe             │ │
│  │                  │          │                     │ │
│  │  Can:            │          │  Can:               │ │
│  │  • Create pages  │          │  • View published   │ │
│  │  • Edit all      │          │  • Read metadata    │ │
│  │  • Publish pages │          │  • Access SEO tags  │ │
│  │  • Delete pages  │          │  • Link to content  │ │
│  │  • Change status │          │                     │ │
│  │                  │          │  Cannot:            │ │
│  │  Cannot:         │          │  • View draft pages │
│  │  • Access public │          │  • Edit anything    │
│  │    API directly  │          │  • Change status    │
│  │  (uses admin API)│          │  • Delete pages     │
│  └──────────────────┘          │  • Access admin     │
│                                │                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │ SHARED DATABASE (PostgreSQL)                    │   │
│  │                                                 │   │
│  │ pages (columns):                                │   │
│  │ ├─ id (UUID)                                    │   │
│  │ ├─ title                                        │   │
│  │ ├─ slug (unique)                                │   │
│  │ ├─ content                                      │   │
│  │ ├─ status ← CRITICAL FILTER                    │   │
│  │ │  ├─ 'published' (public viewable)             │   │
│  │ │  ├─ 'draft' (admin only)                      │   │
│  │ │  └─ 'archived' (admin only)                   │   │
│  │ ├─ meta_title (SEO)                             │   │
│  │ ├─ meta_description (SEO)                       │   │
│  │ ├─ category_id (FK)                             │   │
│  │ ├─ created_at                                   │   │
│  │ └─ updated_at                                   │   │
│  │                                                 │   │
│  │ Query Filters:                                  │   │
│  │ Admin: SELECT * FROM pages (all statuses)      │   │
│  │ Public: SELECT * FROM pages                     │   │
│  │         WHERE status = 'published' ← SAFETY ✓  │   │
│  │         AND slug = ?                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ SECURITY GATES                                  │   │
│  │                                                 │   │
│  │ Admin Access:                                   │   │
│  │ ├─ Check req.session.userId ✓                  │   │
│  │ ├─ Check req.session.userRole === 'admin' ✓   │   │
│  │ └─ Validate CSRF token ✓                       │   │
│  │                                                 │   │
│  │ Public Access:                                  │   │
│  │ ├─ No session check ✓                          │   │
│  │ ├─ No role check ✓                             │   │
│  │ ├─ Only published pages returned ✓             │   │
│  │ └─ 404 for draft/missing pages ✓               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
CREATE PAGE (Admin)
    │
    ├─ POST /api/admin/pages
    │  Headers: X-Requested-With, Session
    │  Body: {title, slug, content, categoryId, tagIds, metaTitle, metaDescription}
    │  │
    │  ├─ Validate input
    │  ├─ Check slug uniqueness
    │  ├─ Verify category exists
    │  ├─ Verify tags exist
    │  │
    │  └─ INSERT pages (status='draft')
    │     │
    │     └─ Return: Page object
    │
    └─ Response → Auto-redirect to editor


PUBLISH PAGE (Admin)
    │
    ├─ PATCH /api/admin/pages/:id
    │  Headers: X-Requested-With, Session
    │  Body: {status: 'published'}
    │  │
    │  ├─ Check user is admin
    │  ├─ Fetch page (any status)
    │  ├─ Validate new status
    │  │
    │  └─ UPDATE pages SET status='published'
    │     │
    │     ├─ Update triggers: updated_at
    │     │
    │     └─ Return: Page object
    │
    └─ Response → "View Page" button appears


VIEW PUBLISHED PAGE (Public Reader)
    │
    ├─ GET /pages/:slug
    │  No headers needed
    │  No auth needed
    │  │
    │  ├─ GET /api/public/pages/:slug
    │  │  Headers: (standard fetch headers)
    │  │  │
    │  │  ├─ Extract slug parameter
    │  │  │
    │  │  └─ Query:
    │  │     SELECT p.*, c.* FROM pages p
    │  │     LEFT JOIN categories c
    │  │     WHERE p.slug = ?
    │  │     AND p.status = 'published' ← SAFETY
    │  │     │
    │  │     ├─ Found? Row with data
    │  │     ├─ Not found? Empty result
    │  │     │
    │  │     ├─ SELECT tags FROM page_tags
    │  │     │
    │  │     └─ Return: {page: {...}, tags: [...]}
    │  │
    │  └─ Response: 200 OK or 404 Not Found
    │
    ├─ Render page-view.tsx
    │  ├─ Apply SEO meta tags
    │  ├─ Render content
    │  ├─ Show breadcrumbs
    │  ├─ Display metadata
    │  │
    │  └─ Show layout: header + content + footer
    │
    └─ User sees published page


UPDATE PUBLISHED PAGE (Admin)
    │
    ├─ Page stays at /admin/cms/pages/:id/edit
    │  │
    │  ├─ Edit content
    │  │
    │  ├─ PATCH /api/admin/pages/:id
    │  │  (status stays 'published')
    │  │  │
    │  │  ├─ UPDATE pages SET (changed fields)
    │  │  │
    │  │  └─ Return: Updated page
    │  │
    │  └─ Success response
    │
    └─ Public page updates immediately
       (no caching delays)
```

## Component Hierarchy

```
App
├─ Route: /pages/:slug
│  │
│  └─ PageView Component
│     │
│     ├─ useRoute hook (get :slug param)
│     ├─ useQuery hook (fetch from /api/public/pages/:slug)
│     │
│     ├─ Helmet (SEO meta tags)
│     │  ├─ <title>
│     │  ├─ <meta name="description">
│     │  ├─ <meta property="og:*">
│     │  └─ <meta name="twitter:*">
│     │
│     ├─ Header
│     │  ├─ Logo
│     │  └─ Navigation (Home, Search)
│     │
│     ├─ Main Article
│     │  ├─ Breadcrumb Navigation
│     │  ├─ Article Header
│     │  │  ├─ Title (h1)
│     │  │  ├─ Category Badge
│     │  │  ├─ Publication Date
│     │  │  └─ Tags (clickable)
│     │  ├─ Article Content
│     │  │  └─ HTML (dangerouslySetInnerHTML)
│     │  └─ Article Footer
│     │     ├─ "More from Category" link
│     │     └─ "Browse All Pages" link
│     │
│     └─ Footer
│        ├─ Company Info
│        ├─ Quick Links
│        ├─ Legal Links
│        └─ Copyright
```

---

This comprehensive system diagram shows how the public pages system integrates with your existing application, maintaining security while providing public access to published content.
