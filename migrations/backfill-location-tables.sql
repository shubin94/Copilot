-- Migration: Backfill countries, states, cities from detectives table
-- Phase 1: Populate location tables (non-destructive)
-- Safe to run multiple times (idempotent)

BEGIN;

-- Insert missing countries
INSERT INTO countries (name, slug, is_active, created_at)
SELECT DISTINCT
  TRIM(country) as name,
  LOWER(REGEXP_REPLACE(TRIM(country), '[^a-zA-Z0-9]+', '-', 'g')) as slug,
  true,
  now()
FROM detectives
WHERE country IS NOT NULL
  AND country != ''
  AND country != 'Not specified'
ON CONFLICT (slug) DO NOTHING;

-- Insert missing states
INSERT INTO states (country_id, name, slug, is_active, created_at)
SELECT DISTINCT
  c.id,
  TRIM(d.state),
  LOWER(REGEXP_REPLACE(TRIM(d.state), '[^a-zA-Z0-9]+', '-', 'g')),
  true,
  now()
FROM detectives d
JOIN countries c
  ON LOWER(c.slug) = LOWER(REGEXP_REPLACE(TRIM(d.country), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE d.state IS NOT NULL
  AND d.state != ''
  AND d.state != 'Not specified'
ON CONFLICT (country_id, slug) DO NOTHING;

-- Insert missing cities
INSERT INTO cities (country_id, state_id, name, slug, is_active, created_at)
SELECT DISTINCT
  c.id,
  s.id,
  TRIM(d.city),
  LOWER(REGEXP_REPLACE(TRIM(d.city), '[^a-zA-Z0-9]+', '-', 'g')),
  true,
  now()
FROM detectives d
JOIN countries c
  ON LOWER(c.slug) = LOWER(REGEXP_REPLACE(TRIM(d.country), '[^a-zA-Z0-9]+', '-', 'g'))
JOIN states s
  ON s.country_id = c.id
  AND LOWER(s.slug) = LOWER(REGEXP_REPLACE(TRIM(d.state), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE d.city IS NOT NULL
  AND d.city != ''
  AND d.city != 'Not specified'
ON CONFLICT (state_id, slug) DO NOTHING;

COMMIT;
