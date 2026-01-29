-- Create detective_snippets table for storing reusable detective snippet configurations
CREATE TABLE IF NOT EXISTS detective_snippets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  state TEXT,
  city TEXT,
  category TEXT NOT NULL,
  "limit" INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS detective_snippets_name_idx ON detective_snippets(name);
CREATE INDEX IF NOT EXISTS detective_snippets_country_idx ON detective_snippets(country);
CREATE INDEX IF NOT EXISTS detective_snippets_category_idx ON detective_snippets(category);
CREATE INDEX IF NOT EXISTS detective_snippets_created_at_idx ON detective_snippets(created_at);
