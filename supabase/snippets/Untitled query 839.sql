CREATE INDEX IF NOT EXISTS detectives_location_composite_idx
  ON detectives (country_id, state_id, city_id);

CREATE INDEX IF NOT EXISTS services_detective_active_idx
  ON services (detective_id, is_active);

CREATE INDEX IF NOT EXISTS reviews_service_published_idx
  ON reviews (service_id, is_published);