# CMS Admin System - Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (React + TS)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐   │
│  │  Admin Dashboard     │  │   AdminLayout (Sidebar)      │   │
│  │  /admin/cms          │  │   Shared across all pages    │   │
│  └──────────────────────┘  └──────────────────────────────┘   │
│           │                          △                         │
│           │                          │ Wraps                   │
│           │                          │                         │
│  ┌────────┴─────────┬────────────┬───┴────────┐              │
│  │                  │            │            │              │
│  ▼                  ▼            ▼            ▼              │
│ Categories       Tags          Pages         Settings       │
│ /admin/cms/     /admin/cms/    /admin/cms/   (TBD)          │
│ categories      tags           pages-edit                    │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  React Query (Caching + State Management)             │   │
│  │  - Auto refetch on mutation                           │   │
│  │  - Optimistic updates                                 │   │
│  │  - Background sync                                    │   │
│  └───────────────────────────────────────────────────────┘   │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                    API Requests (JSON)
                           │
┌──────────────────────────┼─────────────────────────────────────┐
│                          ▼              BACKEND LAYER          │
│            Express.js Routes (TypeScript)                      │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ Admin Middleware │  │ Zod Validation   │                  │
│  │ requireAdmin()   │  │ Input Validation │                  │
│  └──────────────────┘  └──────────────────┘                  │
│           △                      △                             │
│           │ Applied to           │ Applied to                  │
│           │ all routes           │ all routes                  │
│                                                                │
│  ┌────────────────────────────────────────────────┐          │
│  │ Routes (server/routes/admin-cms.ts)             │          │
│  │                                                │          │
│  │ ┌────────────────────────────────────────┐    │          │
│  │ │ POST /api/admin/categories             │    │          │
│  │ │ GET /api/admin/categories?status=...   │    │          │
│  │ │ PATCH /api/admin/categories/:id        │    │          │
│  │ │ DELETE /api/admin/categories/:id       │    │          │
│  │ └────────────────────────────────────────┘    │          │
│  │                                                │          │
│  │ ┌────────────────────────────────────────┐    │          │
│  │ │ POST /api/admin/tags                   │    │          │
│  │ │ GET /api/admin/tags?status=...         │    │          │
│  │ │ PATCH /api/admin/tags/:id              │    │          │
│  │ │ DELETE /api/admin/tags/:id             │    │          │
│  │ └────────────────────────────────────────┘    │          │
│  │                                                │          │
│  │ ┌────────────────────────────────────────┐    │          │
│  │ │ POST /api/admin/pages (+ tags)         │    │          │
│  │ │ GET /api/admin/pages?status=...        │    │          │
│  │ │ PATCH /api/admin/pages/:id (+ tags)    │    │          │
│  │ │ DELETE /api/admin/pages/:id            │    │          │
│  │ └────────────────────────────────────────┘    │          │
│  │                                                │          │
│  └────────────────────────────────────────────────┘          │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                    SQL Queries + Transactions
                           │
┌──────────────────────────┼─────────────────────────────────────┐
│                          ▼        STORAGE LAYER                │
│         (server/storage/cms.ts)                                │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ Category CRUD    │  │ Tag CRUD         │                  │
│  │                  │  │                  │                  │
│  │ getCategories()  │  │ getTags()        │                  │
│  │ getCategoryById()│  │ getTagById()     │                  │
│  │ createCategory()│  │ createTag()      │                  │
│  │ updateCategory()│  │ updateTag()      │                  │
│  └──────────────────┘  └──────────────────┘                  │
│                                                                │
│  ┌────────────────────────────────────────┐                  │
│  │ Page CRUD (with Tag Transactions)       │                  │
│  │                                        │                  │
│  │ getPages(status?)                      │                  │
│  │ getPageById(id)                        │                  │
│  │ createPage(title, slug, categoryId,    │                  │
│  │            content, tagIds, status)    │                  │
│  │ updatePage(id, title, status,          │                  │
│  │            content, tagIds) -- ATOMIC  │                  │
│  │ deletePage(id) -- CASCADE              │                  │
│  └────────────────────────────────────────┘                  │
│                                                                │
│  ┌────────────────────────────────────────┐                  │
│  │ Transaction Support                    │                  │
│  │ BEGIN → INSERT/UPDATE → COMMIT         │                  │
│  │ Used for page + tag associations       │                  │
│  └────────────────────────────────────────┘                  │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                    Database Queries
                           │
┌──────────────────────────┼─────────────────────────────────────┐
│                          ▼        DATABASE LAYER                │
│              PostgreSQL (Supabase)                              │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │  categories  │  │     tags     │                           │
│  ├──────────────┤  ├──────────────┤                           │
│  │ id (PK, UUID)│  │ id (PK, UUID)│                           │
│  │ name         │  │ name         │                           │
│  │ slug (UQ)    │  │ slug (UQ)    │                           │
│  │ status       │  │ status       │                           │
│  │ created_at   │  │ created_at   │                           │
│  │ updated_at   │  │ updated_at   │                           │
│  └──────────────┘  └──────────────┘                           │
│          △                △                                     │
│          │ FK            │ FK                                   │
│          │               │                                      │
│  ┌───────┴───────────────┴──────────────┐                     │
│  │         pages                        │                     │
│  ├──────────────────────────────────────┤                     │
│  │ id (PK, UUID)                        │                     │
│  │ title                                │                     │
│  │ slug (UQ)                            │                     │
│  │ category_id (FK → categories)        │                     │
│  │ content                              │                     │
│  │ status                               │                     │
│  │ created_at                           │                     │
│  │ updated_at                           │                     │
│  └──────────────────────────────────────┘                     │
│                  △                                              │
│                  │ FK (Composite)                              │
│                  │                                              │
│  ┌──────────────────────────────────────┐                     │
│  │      page_tags (Junction)            │                     │
│  ├──────────────────────────────────────┤                     │
│  │ page_id (FK → pages) ─┐              │                     │
│  │ tag_id (FK → tags)  ──┼─ PK         │                     │
│  └──────────────────────────────────────┘                     │
│                                                                │
│  Indexes & Constraints:                                       │
│  ├─ UNIQUE: categories.slug                                  │
│  ├─ UNIQUE: tags.slug                                         │
│  ├─ UNIQUE: pages.slug                                        │
│  ├─ FK: pages.category_id → categories.id CASCADE            │
│  ├─ FK: page_tags.page_id → pages.id CASCADE                 │
│  ├─ FK: page_tags.tag_id → tags.id CASCADE                   │
│  ├─ INDEX: categories.status                                 │
│  ├─ INDEX: tags.status                                        │
│  ├─ INDEX: pages.status                                       │
│  └─ INDEX: pages.category_id                                 │
│                                                                │
│  Triggers:                                                    │
│  ├─ Auto-update categories.updated_at                        │
│  ├─ Auto-update tags.updated_at                              │
│  └─ Auto-update pages.updated_at                             │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Examples

### Create Page with Tags (Atomic)
```
USER ACTION
    ↓
React Form Submit
    ↓
API Call: POST /api/admin/pages
    ↓
requireAdmin Middleware
    ↓
Zod Validation
    ├─ title required ✓
    ├─ slug required ✓
    ├─ categoryId required ✓
    ├─ tagIds.length >= 1 ✓
    └─ all tagIds exist ✓
    ↓
BEGIN TRANSACTION
    ↓
    ├─ INSERT into pages
    │  VALUES (id, title, slug, categoryId, content, status, now(), now())
    │
    └─ INSERT into page_tags (multiple rows)
       VALUES (pageId, tagId1), (pageId, tagId2), ...
    ↓
COMMIT TRANSACTION
    ↓
Response: { page: {..., tags: [...]} }
    ↓
React Query invalidates ["/api/admin/pages"]
    ↓
Page list refreshed with new page
    ↓
Modal closes, success confirmation shown
```

### Update Page (with Tag Reassignment)
```
USER ACTION: Change tags + title
    ↓
API Call: PATCH /api/admin/pages/:id
    ↓
requireAdmin Middleware
    ↓
Zod Validation (partial, only provided fields)
    ↓
BEGIN TRANSACTION
    ↓
    ├─ UPDATE pages SET title, status, content, updated_at = now()
    │  WHERE id = :id
    │
    └─ DELETE FROM page_tags WHERE page_id = :id
       INSERT INTO page_tags (page_id, tag_id)
       VALUES (:id, :tagId1), (:id, :tagId2), ...
    ↓
COMMIT TRANSACTION
    ↓
Response: { page: {..., tags: [...]} }
    ↓
UI updates immediately with new data
```

### List with Filter
```
USER ACTION: Select "published" status filter
    ↓
API Call: GET /api/admin/pages?status=published
    ↓
Query Builder
    ↓
SELECT * FROM pages
WHERE status = 'published'
ORDER BY created_at DESC
    ↓
JOIN categories (for category names)
LEFT JOIN page_tags → tags (for tag info)
    ↓
Format Response
    ├─ Convert snake_case to camelCase
    ├─ Aggregate tags array per page
    └─ Return: { pages: [...] }
    ↓
React Query caches result
    ↓
UI renders table with 50+ pages (cached)
```

---

## 🔐 Security Flow

```
Incoming Request
    ↓
Express Middleware Stack
    ├─ CORS
    ├─ Auth Session Check
    └─ Body Parser
    ↓
Admin Router
    ├─ requireAdmin Middleware
    │  ├─ Check req.user.role === 'admin'
    │  ├─ If false: res.status(403)
    │  └─ If true: next()
    │
    └─ Route Handler
        ├─ Zod Validation
        │  ├─ Parse req.body
        │  ├─ Check schema
        │  └─ If error: res.status(400)
        │
        ├─ Database Operations
        │  ├─ parameterized queries
        │  ├─ transaction safety
        │  └─ constraint checks
        │
        └─ Response
           ├─ Success: res.json({ data })
           └─ Error: res.status(4xx).json({ error })
```

---

## 📊 State Management Flow

```
Admin Page Loads
    ↓
useQuery(["/api/admin/pages"])
    ├─ First time: Fetch from API
    ├─ Cached: Return from cache
    └─ Stale: Background refetch
    ↓
setData(response)
    ↓
Component Re-renders with data
    ↓
User Action (Create/Edit/Delete)
    ↓
useMutation (POST/PATCH/DELETE)
    ├─ Show loading state
    ├─ Call API
    └─ Handle response
    ↓
    ├─ Error: Show error message
    │
    └─ Success:
        ├─ invalidateQueries(["/api/admin/pages"])
        ├─ Triggers automatic refetch
        ├─ Updates cache with fresh data
        ├─ Close modal
        └─ Show success feedback
    ↓
Page list updates automatically
```

---

## 🎯 Component Hierarchy

```
App.tsx
├─ Route: /admin/cms
│  └─ AdminDashboard
│     └─ Stats Cards
│
├─ Route: /admin/cms/categories
│  └─ CategoriesAdmin
│     ├─ AdminLayout
│     │  ├─ Sidebar Navigation
│     │  └─ Main Content
│     ├─ Category Table
│     └─ Add/Edit Modal
│
├─ Route: /admin/cms/tags
│  └─ TagsAdmin
│     ├─ AdminLayout
│     ├─ Tag Table
│     └─ Add/Edit Modal
│
└─ Route: /admin/cms/pages
   └─ PagesAdminEdit
      ├─ AdminLayout
      ├─ Page Table
      └─ Comprehensive Modal
         ├─ Title Input
         ├─ Slug Input
         ├─ Category Select
         ├─ Tags MultiSelect
         ├─ Content Textarea
         └─ Status Select
```

---

## 🔄 Request/Response Examples

### Create Category Request/Response
```
REQUEST:
POST /api/admin/categories
Content-Type: application/json

{
  "name": "Technology",
  "slug": "technology",
  "status": "published"
}

RESPONSE 200:
{
  "category": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Technology",
    "slug": "technology",
    "status": "published",
    "createdAt": "2025-01-30T10:30:00Z",
    "updatedAt": "2025-01-30T10:30:00Z"
  }
}
```

### Create Page Request/Response
```
REQUEST:
POST /api/admin/pages
Content-Type: application/json

{
  "title": "Getting Started with React",
  "slug": "getting-started-react",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "content": "<h1>Guide</h1>...",
  "tagIds": [
    "e96f29b6-e0de-43c4-b9dc-01cb1a6c6000",
    "f29b6e0d-e0de-43c4-b9dc-01cb1a6c6111"
  ],
  "status": "draft"
}

RESPONSE 200:
{
  "page": {
    "id": "a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6",
    "title": "Getting Started with React",
    "slug": "getting-started-react",
    "categoryId": "550e8400-e29b-41d4-a716-446655440000",
    "content": "<h1>Guide</h1>...",
    "status": "draft",
    "tags": [
      { "id": "e96f29b6-...", "name": "React" },
      { "id": "f29b6e0d-...", "name": "JavaScript" }
    ],
    "createdAt": "2025-01-30T10:30:00Z",
    "updatedAt": "2025-01-30T10:30:00Z"
  }
}
```

### Error Response (409 Conflict)
```
REQUEST:
POST /api/admin/categories
{ "name": "Tech", "slug": "technology" }  # technology already exists

RESPONSE 409:
{
  "error": "Slug already exists"
}
```

### Error Response (403 Unauthorized)
```
REQUEST:
POST /api/admin/categories  # User role = "detective"
{ "name": "Tech", "slug": "tech" }

RESPONSE 403:
{
  "error": "Admin access required"
}
```

---

## ✨ Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Soft Deletes** | Data preservation for auditing, easy archival without data loss |
| **Slug Uniqueness** | SEO-friendly URLs, prevents conflicts, globally unique per entity |
| **Tag Requirements** | Ensures proper content organization, many-to-many flexibility |
| **Atomic Transactions** | Page + tags always consistent, no orphaned records |
| **Admin Middleware** | Single place for auth check, DRY principle |
| **React Query** | Automatic caching, optimistic updates, background sync |
| **Zod Validation** | Type-safe, comprehensive error messages, client+server compatible |
| **Separate Tables** | Normal form (3NF), eliminates data duplication, flexible queries |

---

This architecture is **scalable**, **maintainable**, and **production-ready**. 🚀
