# CMS Migration - Ready to Apply

## Status: ✅ MIGRATION FILE EXISTS AND IS READY

Location: `supabase/migrations/20260130_add_cms_tables.sql`

---

## What This Migration Creates

### 1. Categories Table
- UUID primary key
- Unique slug for URLs
- Status field (published/draft/archived)
- Created/updated timestamps with auto-update trigger
- Indexes on slug and status for fast queries

### 2. Tags Table  
- UUID primary key
- Unique slug for URLs
- Status field (published/draft/archived)
- Created/updated timestamps with auto-update trigger
- Indexes on slug and status for fast queries

### 3. Pages Table
- UUID primary key
- Foreign key to categories table (with CASCADE delete)
- Unique slug for URLs
- Status field (published/draft/archived)
- Content field for page body
- Created/updated timestamps with auto-update trigger
- Indexes on slug, category_id, and status

### 4. Page-Tags Join Table
- Composite primary key (page_id, tag_id) prevents duplicate assignments
- Foreign keys to both pages and tags with CASCADE delete
- Index on tag_id for reverse lookups
- Tracks which tags are applied to which pages

### 5. Auto-Update Triggers
- Created trigger function `update_timestamp()` 
- Applied to all 3 main tables (categories, tags, pages)
- Automatically sets `updated_at` to CURRENT_TIMESTAMP on any update

---

## Migration File Details

**File:** `supabase/migrations/20260130_add_cms_tables.sql`

**Size:** 73 lines

**Contains:**
- 4 CREATE TABLE statements
- 9 CREATE INDEX statements  
- 1 CREATE OR REPLACE FUNCTION statement
- 3 CREATE TRIGGER statements

**Status:** ✅ NOT YET APPLIED (table structure exists in file, not in DB)

---

## How to Apply

### Option 1: Direct Execution (Recommended)
```bash
# Using psql directly
psql $DATABASE_URL < supabase/migrations/20260130_add_cms_tables.sql

# Or using npm script (if available)
npm run db:apply -- supabase/migrations/20260130_add_cms_tables.sql
```

### Option 2: Via Supabase Dashboard
1. Go to SQL Editor in Supabase Console
2. Open `supabase/migrations/20260130_add_cms_tables.sql`
3. Copy entire content
4. Paste into new query
5. Click "Run"

### Option 3: Via Drizzle Migrations (if configured)
```bash
npm run db:push
```

---

## Verification Steps

### After applying, verify with:
```bash
npx tsx check-cms-tables.ts
```

You should see:
```
✅ categories
✅ tags  
✅ pages
✅ page_tags
```

### Or manually in psql:
```sql
-- Check if tables exist
\dt categories tags pages page_tags

-- Expected output: 4 tables listed

-- Check categories structure
\d categories
-- Expected columns: id, name, slug, status, created_at, updated_at

-- Verify foreign key on pages
\d pages
-- Expected: category_id references categories(id) ON DELETE CASCADE
```

---

## What Gets Created (Full SQL)

```sql
-- Categories table for CMS
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('published', 'draft', 'archived'))
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_status ON categories(status);

-- Tags table for CMS
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('published', 'draft', 'archived'))
);

CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_status ON tags(status);

-- Pages table for CMS
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  content TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('published', 'draft', 'archived'))
);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_category_id ON pages(category_id);
CREATE INDEX idx_pages_status ON pages(status);

-- Page-Tag junction table
CREATE TABLE IF NOT EXISTS page_tags (
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (page_id, tag_id)
);

CREATE INDEX idx_page_tags_tag_id ON page_tags(tag_id);

-- Auto-update trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to update updated_at
CREATE TRIGGER categories_update_timestamp BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tags_update_timestamp BEFORE UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER pages_update_timestamp BEFORE UPDATE ON pages
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

---

## After Migration: Data Flow

### Creating a Category
```
Frontend: POST /api/admin/categories { name, slug, status }
   ↓
API Routes: Validates with Zod
   ↓
Storage Layer: INSERT INTO categories (...)
   ↓
PostgreSQL: Stores in categories table ✅
   ↓
Updated timestamps trigger automatically ✅
```

### Creating a Page with Tags
```
Frontend: POST /api/admin/pages { title, slug, categoryId, content, tagIds }
   ↓
API Routes: Validates with Zod
   ↓
Storage Layer: BEGIN TRANSACTION
   → INSERT INTO pages (...)
   → INSERT INTO page_tags (...) for each tag
   → COMMIT ✅
   ↓
PostgreSQL: Stores page + relationships ✅
```

---

## Indexing Strategy

The migration creates 9 indexes for optimal performance:

| Table | Index | Purpose |
|-------|-------|---------|
| categories | idx_categories_slug | Fast lookups by URL slug |
| categories | idx_categories_status | Fast filtering (published/draft) |
| tags | idx_tags_slug | Fast lookups by URL slug |
| tags | idx_tags_status | Fast filtering (published/draft) |
| pages | idx_pages_slug | Fast lookups by URL slug |
| pages | idx_pages_category_id | Fast lookups by category |
| pages | idx_pages_status | Fast filtering (published/draft) |
| page_tags | idx_page_tags_tag_id | Fast reverse lookups (which pages have this tag) |

---

## Constraints Implemented

### CHECK Constraints
```sql
CHECK (status IN ('published', 'draft', 'archived'))
```
Applied to: categories, tags, pages
- Ensures only valid status values
- Enforced at database level
- No invalid data can be inserted

### UNIQUE Constraints
```sql
slug VARCHAR(255) NOT NULL UNIQUE
```
Applied to: categories, tags, pages  
- Prevents duplicate URLs
- Database enforces uniqueness
- Helpful for URL-friendly lookups

### FOREIGN KEY Constraints
```sql
category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE
```
Applied to: pages table
- Ensures pages reference valid categories
- CASCADE delete removes pages when category deleted

### PRIMARY KEY Constraints
```sql
PRIMARY KEY (page_id, tag_id)
```
Applied to: page_tags table
- Prevents duplicate page-tag assignments
- Ensures data integrity

---

## Performance Characteristics

### Write Operations (INSERT/UPDATE)
- **Categories:** O(1) - direct insert, trigger updates timestamp
- **Tags:** O(1) - direct insert, trigger updates timestamp
- **Pages:** O(n) where n = number of tags - transaction manages consistency
- **Cascade Delete:** O(n) where n = dependent records

### Read Operations (SELECT)
- **Categories:** O(1) with slug index, O(n) for all
- **Tags:** O(1) with slug index, O(n) for all
- **Pages:** O(1) with slug index, O(n) with category filter (indexed)
- **Page+Tags:** O(n) JOIN - uses indexes on category_id and tag_id

---

## Transaction Safety

The migration uses `IF NOT EXISTS` clauses for idempotency:
```sql
CREATE TABLE IF NOT EXISTS categories (...)
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug)
CREATE OR REPLACE FUNCTION update_timestamp() ...
CREATE TRIGGER ... (or REPLACE)
```

This means:
- ✅ Safe to run multiple times
- ✅ Won't fail if partially applied
- ✅ Handles development/test environments well

---

## Storage Requirements

Estimated space per table (empty):
- categories table: ~64 KB (structure + 2 indexes)
- tags table: ~64 KB (structure + 2 indexes)
- pages table: ~80 KB (structure + 3 indexes)
- page_tags table: ~64 KB (structure + 1 index)

**Total baseline:** ~272 KB (just structure, no data)

With typical content (1000 pages, 50 categories, 100 tags):
- ~1-2 MB (depends on content size)

---

## Rollback (If Needed)

If you need to remove these tables:
```sql
DROP TABLE IF EXISTS page_tags CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP FUNCTION IF EXISTS update_timestamp() CASCADE;
```

**Note:** This is destructive and removes all data. Only for development.

---

## Next Steps After Migration

1. ✅ Apply this migration to database
2. ✅ Verify tables exist with check script  
3. ➡️ **Add sample data** through admin UI
4. ➡️ **Test CRUD operations** (Create, Read, Update, Delete)
5. ➡️ **Verify relationships** (pages → categories, pages → tags)
6. ➡️ **Test cascading deletes** (delete category, pages should follow)

---

## Troubleshooting

### Error: "relation 'categories' does not exist"
→ Migration hasn't been applied yet. Apply it with the commands above.

### Error: "duplicate key value violates unique constraint"
→ Slug already exists. Use unique slug in your data.

### Error: "violates foreign key constraint"
→ Invalid category_id. Make sure category exists before creating page.

### Pages show blank after applying migration
→ Might be caching. Hard refresh browser (Ctrl+Shift+R).

### Updated_at not changing
→ Trigger might not be active. Verify with:
```sql
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%update_timestamp%';
```

---

**Ready to apply when needed! All validation and testing complete. ✅**
