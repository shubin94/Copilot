# Public Pages - Quick Start

## The Complete Workflow

```
1. Create Page
   ↓ Auto-Redirect to Editor
2. Edit Page Content
   ↓ Click "Publish"
3. View Page Button Appears
   ↓ Click "View Page" in Green
4. Public Page Opens
   ↓ /pages/:slug
```

## Key URLs

### Admin
- Create/Edit: `http://localhost:5000/admin/cms/pages`
- Edit specific: `http://localhost:5000/admin/cms/pages/:id/edit`

### Public
- View page: `http://localhost:5000/pages/:slug`
- API fetch: `GET /api/public/pages/:slug`

## Admin Features

### In Page Editor
- **Preview Button** (gray) - Toggle preview mode
- **View Page Button** (green, shows only when published) - Open public page in new tab
- **Save Draft** (gray) - Save without publishing
- **Publish** (blue) - Make page public
- **Update** (blue, shows if already published) - Update published page

### Status Indicators
- 🟡 **draft** - Private, not accessible publicly
- 🟢 **published** - Public, viewable at /pages/:slug
- ⚫ **archived** - Hidden from public, not shown in lists

## Public Page Features

What visitors see:
- Page title (large heading)
- Breadcrumb navigation: Home > Category > Page Title
- Category badge (if assigned)
- Publication date
- Tags (clickable, links to search)
- Full HTML content
- Footer with "Browse All Pages" link

SEO Features:
- Meta title (in browser tab)
- Meta description (in search results)
- Open Graph tags (social media share preview)
- Twitter Card (Twitter specific)

## Safety Rules

✅ **Can be public:**
- Published pages (status = 'published')
- Any page slug, title, content, category, tags

❌ **Never public:**
- Draft pages (status = 'draft')
- Archived pages (status = 'archived')
- Admin-only endpoints
- Auth-protected content

## Testing

### Quick Test
1. Go to CMS → Pages
2. Create page titled "Test Page"
3. Auto-redirected to editor
4. Click "Publish" button
5. "View Page" button appears (green)
6. Click "View Page"
7. Page opens in new tab at `/pages/test-page`

### Verify Draft Hidden
1. Create page, save as draft
2. Try to access `/pages/page-slug` directly in new tab
3. Should show 404 "Page not found"

### Check SEO
1. View public page
2. Right-click → "View Page Source"
3. Search for `<title>` and `<meta name="description"`
4. Should show meta title and meta description

## Common Tasks

### Make Draft Public
1. Open in editor
2. Click "Publish" button
3. Click green "View Page" button

### Update Published Page
1. Go to CMS → Pages
2. Click eye icon to open editor
3. Make changes
4. Click "Update" button
5. Changes live immediately

### Hide Published Page
1. Open in editor
2. Change status to "draft" or "archived"
3. Click "Update" button
4. Page now returns 404 on public URL

### Delete Page
1. Go to CMS → Pages
2. Click trash icon
3. Confirm deletion
4. Page removed from database

## URLs for Sharing

Share these with readers:
- Format: `https://yoursite.com/pages/page-slug`
- Example: `https://yoursite.com/pages/wordpress-setup-guide`
- No login required
- Fully public

## Troubleshooting

**Page shows 404:**
- ❌ Not published? → Go to editor, click "Publish"
- ❌ Wrong slug? → Check the slug in editor
- ❌ Just changed slug? → Use new slug in URL

**Meta tags not showing:**
- Check page has meta_title and meta_description filled
- View page source (Ctrl+U) to verify they're in HTML

**View Page button not showing:**
- ❌ Page is draft? → Click "Publish" first
- ❌ Page is archived? → Change status to "published"

**Can't edit after publishing:**
- ✅ You can always edit published pages
- Go to CMS → Pages → Click eye icon
- Make changes → Click "Update" button

---

**Everything is secure. Draft pages are never accessible publicly.**
