-- Migration: Add state and city columns to detectives table
-- Purpose: Store structured location data for filtering and snippets
-- Date: 2026-01-29

-- Add state and city columns
ALTER TABLE detectives 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS detectives_state_idx ON detectives(state);
CREATE INDEX IF NOT EXISTS detectives_city_idx ON detectives(city);

-- Optional: Populate existing detectives with state/city from location string if possible
-- This is a best-effort migration for existing data
-- Format expected: "City, State" or "City"
UPDATE detectives
SET 
  city = CASE 
    WHEN location LIKE '%,%' THEN TRIM(SPLIT_PART(location, ',', 1))
    WHEN location IS NOT NULL AND location != 'Not specified' THEN TRIM(location)
    ELSE NULL
  END,
  state = CASE 
    WHEN location LIKE '%,%' THEN TRIM(SPLIT_PART(location, ',', 2))
    ELSE NULL
  END
WHERE state IS NULL AND city IS NULL AND location IS NOT NULL;

-- Note: This migration does NOT alter the location column
-- Location is kept for backward compatibility with existing queries
