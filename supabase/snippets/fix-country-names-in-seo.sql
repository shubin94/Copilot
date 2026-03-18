-- ============================================================
-- FIX: Country codes showing as "In" / "Us" instead of full names
-- in location_seo_overrides.
--
-- SAFE to run because these rows were auto-seeded (no manual admin edits).
-- Step 1: Delete the bad auto-seeded rows
-- Step 2: Re-insert with proper country names via countries table join
-- ============================================================

-- Step 1: Remove bad rows (only detective profile overrides that were auto-seeded)
DELETE FROM location_seo_overrides
WHERE entity_type = 'detective'
  AND (h1 LIKE '%, In' OR h1 LIKE '%, Us' OR h1 LIKE '%, Gb'
    OR h1 ~ ', [A-Z][a-z]$'   -- ends with 2-letter titlecased code
    OR h1 ~ ', [A-Z][a-z] '); -- 2-letter code followed by space

-- Step 2: Re-insert with countries table join for proper full name
INSERT INTO location_seo_overrides (id, entity_type, entity_id, h1, meta_title, meta_description)
SELECT
  gen_random_uuid(),
  'detective',
  d.id::text,
  coalesce(nullif(d.business_name,''), 'Detective') || ' - Private Investigator in ' || initcap(d.city) || ', ' || coalesce(c.name, initcap(d.country)),
  coalesce(nullif(d.business_name,''), 'Detective') || ' - Private Detective in ' || initcap(d.city) || ' | AskDetectives',
  'Hire ' || coalesce(nullif(d.business_name,''), 'a trusted private detective') || ' in ' || initcap(d.city) || ', ' || coalesce(c.name, initcap(d.country)) || '. View services, reviews and contact details.'
FROM detectives d
LEFT JOIN LATERAL (
  SELECT name FROM countries
  WHERE upper(code) = upper(d.country) OR lower(name) = lower(d.country)
  LIMIT 1
) c ON true
WHERE d.status = 'active'
  AND d.city    IS NOT NULL AND trim(d.city)    <> '' AND trim(d.city)    <> 'Not specified'
  AND d.country IS NOT NULL AND trim(d.country) <> ''
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  h1               = EXCLUDED.h1,
  meta_title       = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  updated_at       = NOW();

-- Verify
SELECT h1 FROM location_seo_overrides WHERE entity_type = 'detective' LIMIT 10;
