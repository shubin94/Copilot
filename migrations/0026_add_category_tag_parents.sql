-- Add parent_id columns to enable hierarchical categories and tags

-- Add parent_id to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- Add parent_id to tags table
ALTER TABLE tags 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES tags(id) ON DELETE SET NULL;

-- Create indexes for better query performance on parent lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
