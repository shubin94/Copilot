CREATE INDEX IF NOT EXISTS idx_reviews_service_published_rating
  ON reviews(service_id, is_published, rating)
  WHERE is_published = true AND rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_service_published_comment
  ON reviews(service_id, rating DESC, created_at DESC)
  WHERE is_published = true AND comment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_detective_active
  ON services(detective_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_services_detective_active_order
  ON services(detective_id, is_active, order_count DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status_created
  ON payment_orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_detective_status_created
  ON payment_orders(detective_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_detectives_user_id
  ON detectives(user_id);

CREATE INDEX IF NOT EXISTS idx_access_pages_key
  ON access_pages(key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_pages_user_page
  ON user_pages(user_id, page_id);

CREATE INDEX IF NOT EXISTS idx_pages_status_created
  ON pages(status, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_categories_slug
  ON categories(slug);

CREATE INDEX IF NOT EXISTS idx_tags_slug
  ON tags(slug);

CREATE INDEX IF NOT EXISTS idx_detectives_location
  ON detectives(status, country, state, city);

CREATE INDEX IF NOT EXISTS idx_location_seo_overrides_lookup
  ON location_seo_overrides(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_services_category_active
  ON services(is_active, category);

CREATE INDEX IF NOT EXISTS idx_detectives_country_id
  ON detectives(country_id) WHERE country_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_detectives_state_id
  ON detectives(state_id) WHERE state_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_detectives_city_id
  ON detectives(city_id) WHERE city_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_countries_slug ON countries(slug);
CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(code);
CREATE INDEX IF NOT EXISTS idx_states_slug_country ON states(slug, country_id);
CREATE INDEX IF NOT EXISTS idx_cities_slug_state ON cities(slug, state_id);
