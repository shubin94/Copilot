-- Categories table for CMS
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'published', -- published, draft, archived
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
  status VARCHAR(50) DEFAULT 'published', -- published, draft, archived
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
  status VARCHAR(50) DEFAULT 'draft', -- published, draft, archived
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('published', 'draft', 'archived'))
);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_category_id ON pages(category_id);
CREATE INDEX idx_pages_status ON pages(status);

-- Page-Tag junction table (many-to-many)
CREATE TABLE IF NOT EXISTS page_tags (
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (page_id, tag_id)
);

CREATE INDEX idx_page_tags_tag_id ON page_tags(tag_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_update_timestamp BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tags_update_timestamp BEFORE UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER pages_update_timestamp BEFORE UPDATE ON pages
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
