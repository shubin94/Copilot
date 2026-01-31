# Public Pages - Code Reference

## Files Modified Summary

### 1. Backend Route Registration
**File:** `server/routes.ts`

**Import Added (Line ~52):**
```typescript
import publicPagesRouter from "./routes/public-pages.ts";
```

**Route Mounted (Line ~1689):**
```typescript
// Public Pages Routes (read-only access to published pages)
app.use("/api/public/pages", publicPagesRouter);
```

---

### 2. Public API Endpoint
**File:** `server/routes/public-pages.ts` (NEW FILE)

**Complete Implementation:**
```typescript
import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";

const router = Router();

// GET /api/public/pages/:slug
// Returns a single published page by slug with category and tags
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Fetch page by slug, only if published
    const pageResult = await pool.query(
      `SELECT 
        p.id,
        p.title,
        p.slug,
        p.content,
        p.status,
        p.meta_title,
        p.meta_description,
        p.created_at,
        p.updated_at,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug
       FROM pages p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1 AND p.status = 'published'`,
      [slug]
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: "Page not found" });
    }

    const pageRow = pageResult.rows[0];

    // Fetch tags for this page
    const tagsResult = await pool.query(
      `SELECT t.id, t.name, t.slug
       FROM tags t
       INNER JOIN page_tags pt ON t.id = pt.tag_id
       WHERE pt.page_id = $1`,
      [pageRow.id]
    );

    const page = {
      id: pageRow.id,
      title: pageRow.title,
      slug: pageRow.slug,
      content: pageRow.content,
      status: pageRow.status,
      metaTitle: pageRow.meta_title,
      metaDescription: pageRow.meta_description,
      createdAt: pageRow.created_at,
      updatedAt: pageRow.updated_at,
      category: pageRow.category_id ? {
        id: pageRow.category_id,
        name: pageRow.category_name,
        slug: pageRow.category_slug,
      } : null,
      tags: tagsResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
      })),
    };

    res.json({ page });
  } catch (error) {
    console.error("[public-pages] Get page error:", error);
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

export default router;
```

---

### 3. Frontend Route Import
**File:** `client/src/App.tsx`

**Import Added (Line ~53):**
```typescript
// CMS Public Routes
const PageView = lazy(() => import("@/pages/page-view"));
```

**Route Added (Line ~154):**
```typescript
{/* CMS Public Routes */}
<Route path="/pages/:slug" component={PageView} />
```

---

### 4. Public Page Viewer Component
**File:** `client/src/pages/page-view.tsx` (NEW FILE)

**Key Features:**
```typescript
// Type definitions
interface PageData {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
}

// Fetch published page
const { data, isLoading, isError } = useQuery<{ page: PageData }>({
  queryKey: ["public-page", slug],
  queryFn: async () => {
    const res = await fetch(`/api/public/pages/${slug}`);
    if (!res.ok) {
      throw new Error(res.status === 404 ? "Page not found" : "Failed to load page");
    }
    return res.json();
  },
  enabled: !!slug,
});

// Apply SEO meta tags
<Helmet>
  <title>{page.metaTitle || page.title}</title>
  {page.metaDescription && <meta name="description" content={page.metaDescription} />}
  <meta property="og:title" content={page.metaTitle || page.title} />
  <meta property="og:url" content={`${window.location.origin}/pages/${page.slug}`} />
</Helmet>

// Render breadcrumb
<nav className="mb-8 text-sm text-gray-600">
  <a href="/">Home</a>
  {page.category && (
    <>
      <span className="mx-2">/</span>
      <a href={`/search?category=${page.category.slug}`}>
        {page.category.name}
      </a>
    </>
  )}
  <span className="mx-2">/</span>
  <span>{page.title}</span>
</nav>

// Render content
<div
  className="text-gray-800 leading-relaxed"
  dangerouslySetInnerHTML={{ __html: page.content }}
/>

// Render tags
{page.tags.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {page.tags.map((tag) => (
      <a
        key={tag.id}
        href={`/search?tag=${tag.slug}`}
        className="inline-block px-2 py-1 bg-gray-200 rounded text-sm"
      >
        #{tag.name}
      </a>
    ))}
  </div>
)}
```

---

### 5. Admin Editor Enhancement
**File:** `client/src/pages/admin/page-edit.tsx`

**View Page Button Added (Lines ~249-256):**
```typescript
{page.status === "published" && (
  <a
    href={`/pages/${page.slug}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
  >
    <Eye size={18} />
    View Page
  </a>
)}
```

**Placement:** In the button group next to Preview button

**Behavior:**
- Shows only when `page.status === "published"`
- Green color (to distinguish from other actions)
- Opens in new tab (target="_blank")
- Safe referrer policy (rel="noopener noreferrer")
- Links to `/pages/{page.slug}`

---

## API Usage Examples

### Fetch Published Page (Frontend)
```typescript
// In React component
const { data } = useQuery({
  queryKey: ["page", slug],
  queryFn: async () => {
    const res = await fetch(`/api/public/pages/${slug}`);
    if (!res.ok) throw new Error("Page not found");
    return res.json();
  }
});

// Direct fetch
fetch("/api/public/pages/my-page-slug")
  .then(r => r.json())
  .then(data => console.log(data.page));
```

### cURL Examples
```bash
# Get published page
curl http://localhost:5000/api/public/pages/my-page-slug

# Expected response (200):
{
  "page": {
    "id": "...",
    "title": "My Page",
    "slug": "my-page-slug",
    "content": "<h1>...</h1>",
    "status": "published",
    "metaTitle": "...",
    "metaDescription": "...",
    "createdAt": "...",
    "updatedAt": "...",
    "category": { "id": "...", "name": "...", "slug": "..." },
    "tags": [{ "id": "...", "name": "...", "slug": "..." }]
  }
}

# Get draft page (returns 404)
curl http://localhost:5000/api/public/pages/draft-page-slug

# Expected response (404):
{
  "error": "Page not found"
}
```

---

## Database Queries

### Check Published Pages
```sql
-- Get all published pages
SELECT id, title, slug, meta_title, meta_description 
FROM pages 
WHERE status = 'published' 
ORDER BY created_at DESC;

-- Get specific published page
SELECT * FROM pages 
WHERE slug = 'my-page-slug' 
AND status = 'published';

-- With category and tags
SELECT 
  p.*,
  c.name as category_name,
  ARRAY_AGG(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)) as tags
FROM pages p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN page_tags pt ON p.id = pt.page_id
LEFT JOIN tags t ON pt.tag_id = t.id
WHERE p.slug = 'my-page-slug' 
AND p.status = 'published'
GROUP BY p.id, c.id;
```

### Check Draft Pages (Hidden)
```sql
-- Get draft pages (not public)
SELECT id, title, slug, status 
FROM pages 
WHERE status = 'draft';

-- Verify public API won't return these
SELECT * FROM pages 
WHERE slug = 'draft-page' 
AND status = 'published';  -- Returns empty (404)
```

---

## Security Verification

### Test Draft Page Protection
```javascript
// Attempt to access draft page publicly
fetch("/api/public/pages/my-draft-page")
  .then(r => {
    if (!r.ok) {
      console.log("✓ Draft page protected:", r.status); // 404
    }
  });
```

### Test Published Page Access
```javascript
// Publish page via admin
// Then verify it's publicly accessible
fetch("/api/public/pages/my-published-page")
  .then(r => r.json())
  .then(data => {
    if (data.page && data.page.status === 'published') {
      console.log("✓ Published page accessible");
      console.log("✓ Can share at: /pages/" + data.page.slug);
    }
  });
```

### Verify SEO Meta Tags
```javascript
// Check SEO meta tags are in HTML
const title = document.querySelector('title').textContent;
const description = document.querySelector('meta[name="description"]')?.content;
const ogTitle = document.querySelector('meta[property="og:title"]')?.content;

console.log({title, description, ogTitle});
```

---

## Component Structure

### Page View Component Hierarchy
```
<PageView>
  ├─ <Helmet> (SEO meta tags)
  ├─ Header
  │  ├─ Logo
  │  └─ Navigation
  ├─ Main Content
  │  ├─ Breadcrumb
  │  ├─ Article Header
  │  │  ├─ Title
  │  │  ├─ Category Badge
  │  │  ├─ Publication Date
  │  │  └─ Tags
  │  ├─ Article Body
  │  │  └─ HTML Content (dangerouslySetInnerHTML)
  │  └─ Footer
  │     └─ Related Links
  └─ Footer
     ├─ Links
     └─ Copyright
```

---

## Error Handling

### 404 Page Not Found
```typescript
if (isError) return <NotFound />;

// Reasons for 404:
// 1. Page doesn't exist
// 2. Page is draft (not published)
// 3. Page is archived
// 4. Slug is incorrect
```

### Loading State
```typescript
if (isLoading)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
```

---

## Performance Optimization

### Query Optimization
```typescript
// Left join category (optional)
// - Returns NULL if no category
// - Single query, not N+1

// Inner join tags
// - Only returns pages with tags
// - Efficient with INNER JOIN

// Single database query per page load
// - No nested queries
// - No separate API calls for related data
```

### Frontend Caching
```typescript
// TanStack Query handles caching automatically
useQuery({
  queryKey: ["public-page", slug],
  queryFn: async () => { ... },
  // Default caching:
  // - Stale time: 0ms
  // - Cache time: 5 minutes
  // - Automatic refetch on window focus
});
```

---

## Testing Code Snippets

### Test Publishing Page
```typescript
async function testPagePublishing() {
  // 1. Create page (admin)
  const createRes = await fetch("/api/admin/pages", {
    method: "POST",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    credentials: "include",
    body: JSON.stringify({
      title: "Test Page",
      slug: "test-page",
      categoryId: "...",
      content: "<p>Test content</p>",
      tagIds: ["..."],
      metaTitle: "Test",
      metaDescription: "Test page"
    })
  });
  
  // 2. Publish page (admin)
  const updateRes = await fetch("/api/admin/pages/:id", {
    method: "PATCH",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    credentials: "include",
    body: JSON.stringify({ status: "published" })
  });
  
  // 3. Access publicly
  const publicRes = await fetch("/api/public/pages/test-page");
  const data = await publicRes.json();
  
  console.log("✓ Page published:", data.page.status === "published");
  console.log("✓ Publicly accessible:", data.page.title);
}
```

---

This code reference covers all implementation details needed to understand and maintain the public pages system.
