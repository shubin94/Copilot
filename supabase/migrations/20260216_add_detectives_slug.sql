-- Migration: Add detectives table enhancements for slug-based routing
-- Date: 2026-02-16
-- Purpose: Ensure detectives table has slug column for SEO-friendly URLs

-- Add slug column if it doesn't exist
ALTER TABLE detectives
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS detectives_slug_idx ON detectives(slug);
CREATE UNIQUE INDEX IF NOT EXISTS detectives_slug_unique ON detectives(slug);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added detectives slug column';
END $$;
