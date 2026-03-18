-- Unique constraint for detective_location_seo
CREATE UNIQUE INDEX IF NOT EXISTS detective_location_seo_slugs_idx
  ON detective_location_seo (country_slug, COALESCE(state_slug, ''), COALESCE(city_slug, ''));

-- Unique constraint for service_location_seo
CREATE UNIQUE INDEX IF NOT EXISTS service_location_seo_slugs_idx
  ON service_location_seo (service_slug, country_slug, COALESCE(state_slug, ''), COALESCE(city_slug, ''));
