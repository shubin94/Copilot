-- Migration: 05-detective-slug-non-null.sql
-- Date: 2026-03-03
-- Purpose: Backfill NULL detective slugs and make slug column non-nullable
-- Status: IDEMPOTENT (safe to run multiple times)

-- Step 1: Backfill NULL slugs with generated values
-- Uses business_name (or city as fallback) to generate unique slugs
DO $$
DECLARE
  detective_record RECORD;
  base_slug TEXT;
  unique_slug TEXT;
  counter INTEGER;
BEGIN
  -- Loop through all detectives with NULL slugs
  FOR detective_record IN 
    SELECT id, business_name, city 
    FROM detectives 
    WHERE slug IS NULL
  LOOP
    -- Generate base slug from business_name or fallback to city
    IF detective_record.business_name IS NOT NULL AND detective_record.business_name != '' THEN
      base_slug := LOWER(TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(detective_record.business_name, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      )));
    ELSIF detective_record.city IS NOT NULL AND detective_record.city != '' THEN
      base_slug := LOWER(TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(detective_record.city, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      )));
    ELSE
      -- Ultimate fallback: use detective ID
      base_slug := 'detective-' || SUBSTRING(detective_record.id, 1, 8);
    END IF;

    -- Remove leading/trailing hyphens
    base_slug := TRIM(BOTH '-' FROM base_slug);

    -- Ensure slug is not empty
    IF base_slug = '' THEN
      base_slug := 'detective-' || SUBSTRING(detective_record.id, 1, 8);
    END IF;

    -- Find unique slug by appending counter if needed
    unique_slug := base_slug;
    counter := 1;

    WHILE EXISTS (
      SELECT 1 FROM detectives 
      WHERE slug = unique_slug AND id != detective_record.id
    ) LOOP
      unique_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;

    -- Update detective with unique slug
    UPDATE detectives 
    SET slug = unique_slug 
    WHERE id = detective_record.id;

    RAISE NOTICE 'Generated slug for detective %: %', detective_record.id, unique_slug;
  END LOOP;
END $$;

-- Step 2: Make slug column non-nullable (only after all NULLs are backfilled)
-- This will fail if any NULL slugs remain, which is intentional
ALTER TABLE detectives ALTER COLUMN slug SET NOT NULL;

-- Step 3: Ensure unique constraint exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'detectives_slug_key'
  ) THEN
    ALTER TABLE detectives ADD CONSTRAINT detectives_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Step 4: Ensure index exists for performance (idempotent)
CREATE INDEX IF NOT EXISTS detectives_slug_idx ON detectives(slug);
