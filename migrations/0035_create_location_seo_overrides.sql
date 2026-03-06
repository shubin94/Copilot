CREATE TABLE IF NOT EXISTS location_seo_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_slug TEXT NOT NULL,
  state_slug TEXT,
  city_slug TEXT,
  custom_title TEXT,
  custom_meta_description TEXT,
  custom_h1 TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT location_seo_overrides_country_state_city_unique UNIQUE (country_slug, state_slug, city_slug)
);
