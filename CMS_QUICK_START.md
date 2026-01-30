# CMS Admin - Quick Start Guide

## 🚀 Quick Access Links

| Component | Path | Purpose |
|-----------|------|---------|
| **Admin Dashboard** | `/admin/cms` | Main hub for CMS management |
| **Categories** | `/admin/cms/categories` | Manage article/page categories |
| **Tags** | `/admin/cms/tags` | Manage article/page tags |
| **Pages** | `/admin/cms/pages` | Create and manage content pages |

---

## 🔐 Requirements

- **Role**: Must be logged in as `admin`
- **Database**: Migration `20260130_add_cms_tables` must be executed
- **Permissions**: All endpoints require admin-only access

---

## 📱 Admin UI Walkthrough

### Step 1: Access Admin Panel
```
1. Go to http://localhost:5000/admin/cms
2. If not logged in as admin → redirected to home
3. If admin → see dashboard with 4 cards
```

### Step 2: Create Category
```
1. Click "Categories" card or sidebar
2. Click "Add Category" button
3. Type category name (e.g., "Technology")
4. Slug auto-generates → "technology"
5. Click "Save"
✅ Category created
```

### Step 3: Create Tags
```
1. Click "Tags" card or sidebar
2. Click "Add Tag" button
3. Type tag name (e.g., "JavaScript")
4. Slug auto-generates → "javascript"
5. Click "Save"
⚠️ Create at least 2-3 tags for pages
```

### Step 4: Create Page
```
1. Click "Pages" card or sidebar
2. Click "Add Page" button
3. Fill form:
   - Title: "Getting Started with React"
   - Slug: auto-generates → "getting-started-with-react"
   - Category: Select from dropdown (required)
   - Tags: Multi-select at least 1 (hold Ctrl/Cmd to select)
   - Content: Optional HTML/Markdown
4. Click "Save"
✅ Page created with tags
```

---

## 🛠️ API Quick Reference

### Create Category
```bash
curl -X POST http://localhost:5000/api/admin/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Tech", "slug": "tech"}'
```

### List Categories (with filter)
```bash
curl http://localhost:5000/api/admin/categories?status=published
```

### Create Tag
```bash
curl -X POST http://localhost:5000/api/admin/tags \
  -H "Content-Type: application/json" \
  -d '{"name": "React", "slug": "react"}'
```

### Create Page (with tags)
```bash
curl -X POST http://localhost:5000/api/admin/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "React Guide",
    "slug": "react-guide",
    "categoryId": "uuid-of-category",
    "tagIds": ["uuid-of-tag-1", "uuid-of-tag-2"],
    "content": "<h1>Guide</h1>",
    "status": "draft"
  }'
```

### Update Page
```bash
curl -X PATCH http://localhost:5000/api/admin/pages/:id \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title", "status": "published"}'
```

### Delete/Archive Entity
```bash
# Categories/Tags (soft delete)
curl -X DELETE http://localhost:5000/api/admin/categories/:id

# Pages (hard delete)
curl -X DELETE http://localhost:5000/api/admin/pages/:id
```

---

## 📊 Field Reference

### Category Fields
- **name** (required): String, e.g., "Technology"
- **slug** (required): String, unique, e.g., "technology"
- **status** (optional): "published" | "draft" | "archived" (defaults: "draft")

### Tag Fields
- **name** (required): String, e.g., "JavaScript"
- **slug** (required): String, unique, e.g., "javascript"
- **status** (optional): "published" | "draft" | "archived" (defaults: "draft")

### Page Fields
- **title** (required): String, e.g., "Getting Started"
- **slug** (required): String, unique (auto-generated from title)
- **categoryId** (required): UUID, must exist in categories
- **tagIds** (required): UUID[], minimum 1, all must exist in tags
- **content** (optional): String, supports HTML/Markdown
- **status** (optional): "published" | "draft" | "archived" (defaults: "draft")

---

## 🎯 Common Tasks

### Create Full Content Structure
```
1. Create 2-3 Categories
   - Technology
   - Business
   - Lifestyle

2. Create 10+ Tags
   - JavaScript, React, Vue
   - Marketing, Sales, Growth
   - Productivity, Health, etc.

3. Create Pages in each Category
   - Assign different tags to each page
   - Pages can share tags (many-to-many)
```

### Change Page Status
```
1. Go to Pages list
2. Click Edit (pencil icon)
3. Change status dropdown
4. Click Save
```

### Move Page to Different Category
```
1. Click Edit on page
2. Change Category dropdown
3. Click Save
```

### Delete Everything (Cleanup)
```
1. Delete all pages first (hard delete)
2. Then delete tags (soft delete to archive)
3. Then delete categories (soft delete to archive)
```

---

## ⚠️ Important Rules

### ❌ Cannot Do
- Create page without category
- Create page without at least 1 tag
- Create category/tag without name or slug
- Have duplicate slugs within same entity type
- Access admin pages without admin role

### ✅ Can Do
- Archive (not delete) categories and tags
- Hard delete pages and cascades to tags
- Edit slug on existing category/tag
- Select multiple tags for one page
- Move pages between categories
- Change page status multiple times

---

## 🐛 Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Admin access required" | Not logged as admin | Login with admin account |
| "Slug already exists" | Duplicate slug | Choose different slug |
| "At least one tag required" | Page without tags | Select minimum 1 tag |
| "Category not found" | Invalid categoryId | Select valid category |
| "Tag [...] not found" | Invalid tagId | Select valid tags |
| "Category is required" | Missing category | Select category |

---

## 📱 Dashboard Cards Overview

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Categories  │  │    Tags     │  │    Pages    │  │  Settings   │
│ Manage      │  │ Manage      │  │ Create &    │  │ System      │
│ article     │  │ article &   │  │ manage      │  │ settings    │
│ categories  │  │ page tags   │  │ pages       │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

---

## 🔄 Typical Workflow

### Content Creator Workflow
```
1. Admin creates Categories (once, then reuse)
2. Admin creates Tags (ongoing as needed)
3. Admin creates Pages by:
   - Writing title
   - Choosing category
   - Assigning relevant tags
   - Adding content
4. Change status to "published" when ready
```

### Content Editor Workflow
```
1. Go to /admin/cms/pages
2. Find page in list (search by status)
3. Click Edit
4. Update content/title/tags
5. Change status if needed
6. Click Save
```

---

## 📞 Support

For issues with CMS admin:
1. Check error message and table above
2. Verify user has admin role
3. Check database connection
4. Ensure migration was executed
5. Clear browser cache and retry

For API debugging:
1. Use curl or Postman
2. Check response status code
3. Log contains detailed error messages
4. Verify request body JSON format
