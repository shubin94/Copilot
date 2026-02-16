-- Add slug column to detectives table for SEO-friendly URLs
-- This enables unique service URLs when combined with service slug and location

-- Add slug column (unique for SEO-friendly detective profile URLs)
ALTER TABLE IF EXISTS detectives ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS detectives_slug_idx ON detectives(slug);
