-- Migration: Add slug columns to countries and states for SEO-friendly URLs
-- Adds `slug` to `countries` and `states` tables (if they exist)
-- Adds unique indexes: countries.slug and (states.country_id, states.slug)

BEGIN;

-- Add slug column to countries (if table exists)
ALTER TABLE IF EXISTS countries
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NOT NULL DEFAULT '';

-- Ensure unique index on countries.slug
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'countries') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i' AND c.relname = 'countries_slug_idx'
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS countries_slug_idx ON countries(slug);
    END IF;
  END IF;
END$$;

-- Add slug column to states (if table exists)
ALTER TABLE IF EXISTS states
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NOT NULL DEFAULT '';

-- Ensure composite unique index on (country_id, slug)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'states') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i' AND c.relname = 'states_country_slug_uq'
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS states_country_slug_uq ON states(country_id, slug);
    END IF;
  END IF;
END$$;

COMMIT;
