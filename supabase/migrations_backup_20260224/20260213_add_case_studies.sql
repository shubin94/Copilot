-- Create case_studies table for articles and success stories
CREATE TABLE IF NOT EXISTS case_studies (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt_html TEXT,
  detective_id VARCHAR(36) REFERENCES detectives(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Investigation',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  thumbnail TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS case_studies_slug_idx ON case_studies(slug);
CREATE UNIQUE INDEX IF NOT EXISTS case_studies_slug_unique ON case_studies(slug);
CREATE INDEX IF NOT EXISTS case_studies_detective_id_idx ON case_studies(detective_id);
CREATE INDEX IF NOT EXISTS case_studies_category_idx ON case_studies(category);
CREATE INDEX IF NOT EXISTS case_studies_published_at_idx ON case_studies(published_at DESC);
CREATE INDEX IF NOT EXISTS case_studies_featured_idx ON case_studies(featured);
