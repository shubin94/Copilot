-- ============================================================
-- STEP 1: Ensure all required columns exist on the 3 SEO tables
-- (Safe to run even if columns already exist)
-- ============================================================

-- detective_location_seo: add missing columns + drop NOT NULL on nullable slug columns
ALTER TABLE detective_location_seo
  ADD COLUMN IF NOT EXISTS state_slug       TEXT,
  ADD COLUMN IF NOT EXISTS city_slug        TEXT,
  ADD COLUMN IF NOT EXISTS h1               TEXT,
  ADD COLUMN IF NOT EXISTS meta_title       TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE detective_location_seo
  ALTER COLUMN state_slug DROP NOT NULL,
  ALTER COLUMN city_slug  DROP NOT NULL;

-- service_location_seo: add missing columns + drop NOT NULL on nullable slug columns
ALTER TABLE service_location_seo
  ADD COLUMN IF NOT EXISTS state_slug        TEXT,
  ADD COLUMN IF NOT EXISTS city_slug         TEXT,
  ADD COLUMN IF NOT EXISTS area_slug         TEXT,
  ADD COLUMN IF NOT EXISTS h1                TEXT,
  ADD COLUMN IF NOT EXISTS meta_title        TEXT,
  ADD COLUMN IF NOT EXISTS meta_description  TEXT;
ALTER TABLE service_location_seo
  ALTER COLUMN state_slug DROP NOT NULL,
  ALTER COLUMN city_slug  DROP NOT NULL,
  ALTER COLUMN area_slug  DROP NOT NULL;

-- location_seo_overrides: should already be complete, but just in case
ALTER TABLE location_seo_overrides
  ADD COLUMN IF NOT EXISTS h1               TEXT,
  ADD COLUMN IF NOT EXISTS meta_title       TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT;


-- ============================================================
-- STEP 2: Check what columns the detectives table actually has
-- Run this first to confirm before seeding
-- ============================================================
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('detectives', 'detective_location_seo', 'service_location_seo', 'location_seo_overrides')
ORDER BY table_name, ordinal_position;


-- ============================================================
-- STEP 3: Seed detective_location_seo
-- Uses detectives.country / state / city (text fields) directly
-- and slugifies them for the SEO tables
-- ============================================================

-- 3a. Country level
INSERT INTO detective_location_seo (country_slug, state_slug, city_slug, h1, meta_title, meta_description)
SELECT
  lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi')) AS country_slug,
  NULL,
  NULL,
  'Private Detectives in ' || initcap(d.country),
  'Private Detectives in ' || initcap(d.country) || ' | AskDetectives',
  'Find trusted private detectives in ' || initcap(d.country) || '. Browse verified investigators and hire the best professional for your case.'
FROM (
  SELECT DISTINCT country FROM detectives WHERE status = 'active' AND country IS NOT NULL AND trim(country) <> ''
) d
WHERE NOT EXISTS (
  SELECT 1 FROM detective_location_seo x
  WHERE x.country_slug = lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi'))
    AND x.state_slug IS NULL
    AND x.city_slug  IS NULL
);

-- 3b. State level
INSERT INTO detective_location_seo (country_slug, state_slug, city_slug, h1, meta_title, meta_description)
SELECT
  lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi')) AS country_slug,
  lower(regexp_replace(trim(d.state),   '[^a-z0-9]+', '-', 'gi')) AS state_slug,
  NULL,
  'Private Detectives in ' || initcap(d.state) || ', ' || initcap(d.country),
  'Private Detectives in ' || initcap(d.state) || ' | AskDetectives',
  'Find trusted private detectives in ' || initcap(d.state) || ', ' || initcap(d.country) || '. Browse verified investigators and hire professionals.'
FROM (
  SELECT DISTINCT country, state FROM detectives WHERE status = 'active' AND state IS NOT NULL AND trim(state) <> '' AND trim(state) <> 'Not specified'
) d
WHERE NOT EXISTS (
  SELECT 1 FROM detective_location_seo x
  WHERE x.country_slug = lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi'))
    AND x.state_slug   = lower(regexp_replace(trim(d.state),   '[^a-z0-9]+', '-', 'gi'))
    AND x.city_slug   IS NULL
);

-- 3c. City level
INSERT INTO detective_location_seo (country_slug, state_slug, city_slug, h1, meta_title, meta_description)
SELECT
  lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi')) AS country_slug,
  lower(regexp_replace(trim(d.state),   '[^a-z0-9]+', '-', 'gi')) AS state_slug,
  lower(regexp_replace(trim(d.city),    '[^a-z0-9]+', '-', 'gi')) AS city_slug,
  'Private Detectives in ' || initcap(d.city) || ', ' || initcap(d.state),
  'Private Detectives in ' || initcap(d.city) || ', ' || initcap(d.state) || ' | AskDetectives',
  'Find trusted private detectives in ' || initcap(d.city) || ', ' || initcap(d.state) || ', ' || initcap(d.country) || '. Compare verified investigators.'
FROM (
  SELECT DISTINCT country, state, city FROM detectives
  WHERE status = 'active'
    AND city    IS NOT NULL AND trim(city)    <> '' AND trim(city)    <> 'Not specified'
    AND state   IS NOT NULL AND trim(state)   <> '' AND trim(state)   <> 'Not specified'
    AND country IS NOT NULL AND trim(country) <> ''
) d
WHERE NOT EXISTS (
  SELECT 1 FROM detective_location_seo x
  WHERE x.country_slug = lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi'))
    AND x.state_slug   = lower(regexp_replace(trim(d.state),   '[^a-z0-9]+', '-', 'gi'))
    AND x.city_slug    = lower(regexp_replace(trim(d.city),    '[^a-z0-9]+', '-', 'gi'))
);


-- ============================================================
-- STEP 4: Seed service_location_seo
-- ============================================================

-- 4a. Country level
INSERT INTO service_location_seo (service_slug, country_slug, state_slug, city_slug, area_slug, h1, meta_title, meta_description)
SELECT
  cat_slug, country_slug, NULL, NULL, NULL,
  cat_title || ' Services in ' || country_name,
  cat_title || ' Services in ' || country_name || ' | AskDetectives',
  'Find trusted ' || lower(category) || ' services in ' || country_name || '. Compare professionals and hire the best.'
FROM (
  SELECT DISTINCT
    regexp_replace(lower(trim(coalesce(svc.category,''))), '[^a-z0-9]+', '-', 'g') AS cat_slug,
    initcap(replace(regexp_replace(lower(trim(coalesce(svc.category,''))), '[^a-z0-9]+', ' ', 'g'), '  ', ' ')) AS cat_title,
    trim(svc.category) AS category,
    lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi')) AS country_slug,
    initcap(d.country) AS country_name
  FROM services svc
  JOIN detectives d ON d.id = svc.detective_id AND d.status = 'active'
  WHERE svc.is_active = true AND d.country IS NOT NULL AND trim(d.country) <> ''
) combo
WHERE NOT EXISTS (
  SELECT 1 FROM service_location_seo x
  WHERE x.service_slug = combo.cat_slug
    AND x.country_slug = combo.country_slug
    AND x.state_slug  IS NULL
    AND x.city_slug   IS NULL
);

-- 4b. State level
INSERT INTO service_location_seo (service_slug, country_slug, state_slug, city_slug, area_slug, h1, meta_title, meta_description)
SELECT
  cat_slug, country_slug, state_slug, NULL, NULL,
  cat_title || ' Services in ' || state_name || ', ' || country_name,
  cat_title || ' Services in ' || state_name || ' | AskDetectives',
  'Find trusted ' || lower(category) || ' services in ' || state_name || ', ' || country_name || '. Compare professionals and hire the best.'
FROM (
  SELECT DISTINCT
    regexp_replace(lower(trim(coalesce(svc.category,''))), '[^a-z0-9]+', '-', 'g') AS cat_slug,
    initcap(replace(regexp_replace(lower(trim(coalesce(svc.category,''))), '[^a-z0-9]+', ' ', 'g'), '  ', ' ')) AS cat_title,
    trim(svc.category) AS category,
    lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi')) AS country_slug,
    initcap(d.country) AS country_name,
    lower(regexp_replace(trim(d.state),   '[^a-z0-9]+', '-', 'gi')) AS state_slug,
    initcap(d.state) AS state_name
  FROM services svc
  JOIN detectives d ON d.id = svc.detective_id AND d.status = 'active'
  WHERE svc.is_active = true
    AND d.state IS NOT NULL AND trim(d.state) <> '' AND trim(d.state) <> 'Not specified'
) combo
WHERE NOT EXISTS (
  SELECT 1 FROM service_location_seo x
  WHERE x.service_slug = combo.cat_slug
    AND x.country_slug = combo.country_slug
    AND x.state_slug   = combo.state_slug
    AND x.city_slug   IS NULL
);

-- 4c. City level
INSERT INTO service_location_seo (service_slug, country_slug, state_slug, city_slug, area_slug, h1, meta_title, meta_description)
SELECT
  cat_slug, country_slug, state_slug, city_slug, NULL,
  cat_title || ' Services in ' || city_name || ', ' || state_name,
  cat_title || ' Services in ' || city_name || ', ' || state_name || ' | AskDetectives',
  'Find trusted ' || lower(category) || ' services in ' || city_name || ', ' || state_name || ', ' || country_name || '. Compare professionals and hire the best.'
FROM (
  SELECT DISTINCT
    regexp_replace(lower(trim(coalesce(svc.category,''))), '[^a-z0-9]+', '-', 'g') AS cat_slug,
    initcap(replace(regexp_replace(lower(trim(coalesce(svc.category,''))), '[^a-z0-9]+', ' ', 'g'), '  ', ' ')) AS cat_title,
    trim(svc.category) AS category,
    lower(regexp_replace(trim(d.country), '[^a-z0-9]+', '-', 'gi')) AS country_slug,
    initcap(d.country) AS country_name,
    lower(regexp_replace(trim(d.state),   '[^a-z0-9]+', '-', 'gi')) AS state_slug,
    initcap(d.state) AS state_name,
    lower(regexp_replace(trim(d.city),    '[^a-z0-9]+', '-', 'gi')) AS city_slug,
    initcap(d.city) AS city_name
  FROM services svc
  JOIN detectives d ON d.id = svc.detective_id AND d.status = 'active'
  WHERE svc.is_active = true
    AND d.city    IS NOT NULL AND trim(d.city)    <> '' AND trim(d.city)    <> 'Not specified'
    AND d.state   IS NOT NULL AND trim(d.state)   <> '' AND trim(d.state)   <> 'Not specified'
    AND d.country IS NOT NULL AND trim(d.country) <> ''
) combo
WHERE NOT EXISTS (
  SELECT 1 FROM service_location_seo x
  WHERE x.service_slug = combo.cat_slug
    AND x.country_slug = combo.country_slug
    AND x.state_slug   = combo.state_slug
    AND x.city_slug    = combo.city_slug
);


-- ============================================================
-- STEP 5: Seed location_seo_overrides (detective profiles)
-- ============================================================

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
  AND NOT EXISTS (
    SELECT 1 FROM location_seo_overrides x
    WHERE x.entity_type = 'detective' AND x.entity_id = d.id::text
  );


-- ============================================================
-- VERIFY: Row counts after seeding
-- ============================================================
SELECT 'detective_location_seo'             AS table_name, COUNT(*) AS rows FROM detective_location_seo
UNION ALL
SELECT 'service_location_seo',               COUNT(*) FROM service_location_seo
UNION ALL
SELECT 'location_seo_overrides (detectives)', COUNT(*) FROM location_seo_overrides WHERE entity_type = 'detective';
