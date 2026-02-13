-- Migration: Add slug column to detectives table for SEO
-- Date: 2025-01-28
-- Purpose: Enable slug-based URLs like /detectives/india/karnataka/aks-detective-agency-bengaluru/

BEGIN;

-- Add slug column if it doesn't exist (safe for repeated runs)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'detectives' AND column_name = 'slug'
  ) THEN
    ALTER TABLE detectives ADD COLUMN slug VARCHAR(255);
    COMMENT ON COLUMN detectives.slug IS 'URL-friendly slug generated from businessName + city. Used for SEO-friendly detective profile URLs.';
  END IF;
END $$;

-- Create unique index on slug (if doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_detective_slug ON detectives(slug);

-- Create composite index for location-based detective lookups
-- Query pattern: detectives in country X, state Y, with given slug
CREATE INDEX IF NOT EXISTS idx_detective_location_slug 
ON detectives(country, state, city, slug);

-- Add trigger to auto-generate/regenerate slug when businessName or city changes
-- This ensures slug stays in sync with profile edits
CREATE OR REPLACE FUNCTION generate_detective_slug()
RETURNS TRIGGER AS $$
DECLARE
  v_base_slug VARCHAR(255);
BEGIN
  -- Generate slug from businessName + city
  -- Replaces non-alphanumeric with hyphens, converts to lowercase, removes consecutive hyphens
  v_base_slug := LOWER(
    REGEXP_REPLACE(
      CONCAT(NEW.business_name, ' ', COALESCE(NEW.city, 'services')),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
  
  -- Remove leading/trailing hyphens
  v_base_slug := TRIM(BOTH '-' FROM v_base_slug);
  
  -- Set slug if not manually provided, or if businessName/city changed
  IF NEW.slug IS NULL OR 
     (OLD.business_name IS DISTINCT FROM NEW.business_name) OR
     (OLD.city IS DISTINCT FROM NEW.city) THEN
    NEW.slug := v_base_slug;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (to allow re-running migration without errors)
DROP TRIGGER IF EXISTS trg_generate_detective_slug ON detectives;

-- Create trigger
CREATE TRIGGER trg_generate_detective_slug
BEFORE INSERT OR UPDATE ON detectives
FOR EACH ROW
EXECUTE FUNCTION generate_detective_slug();

COMMIT;
