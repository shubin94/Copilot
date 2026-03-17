CREATE TABLE IF NOT EXISTS detective_location_seo (
  id SERIAL PRIMARY KEY,
  country_slug VARCHAR(64) NOT NULL,
  state_slug VARCHAR(64),
  city_slug VARCHAR(64),
  h1 VARCHAR(255),
  meta_title VARCHAR(255),
  meta_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (country_slug, state_slug, city_slug)
);
