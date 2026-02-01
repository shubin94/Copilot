-- Add SEO fields to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_description TEXT;
