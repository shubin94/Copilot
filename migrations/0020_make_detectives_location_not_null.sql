-- Migration: Make detectives.state, detectives.city, detectives.location NOT NULL
-- Purpose: Enforce mandatory location fields
-- Date: 2026-01-29

-- Set defaults to prevent future NULL inserts
ALTER TABLE detectives
  ALTER COLUMN state SET DEFAULT 'Not specified',
  ALTER COLUMN city SET DEFAULT 'Not specified',
  ALTER COLUMN location SET DEFAULT 'Not specified';

-- Backfill existing NULLs
UPDATE detectives
SET state = COALESCE(state, 'Not specified'),
    city = COALESCE(city, 'Not specified'),
    location = COALESCE(location, 'Not specified')
WHERE state IS NULL OR city IS NULL OR location IS NULL;

-- Enforce NOT NULL constraints
ALTER TABLE detectives
  ALTER COLUMN state SET NOT NULL,
  ALTER COLUMN city SET NOT NULL,
  ALTER COLUMN location SET NOT NULL;
