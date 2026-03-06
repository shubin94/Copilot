-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create location_seo_overrides table
-- Schema uses entity_type and entity_id for flexible location tracking:
-- - Country: entity_type='country', entity_id='country-slug'
-- - State: entity_type='state', entity_id='country-slug/state-slug'
-- - City: entity_type='city', entity_id='country-slug/state-slug/city-slug'
CREATE TABLE IF NOT EXISTS location_seo_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('country', 'state', 'city')),
  entity_id TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate overrides for same entity
ALTER TABLE location_seo_overrides 
ADD CONSTRAINT unique_entity_override 
UNIQUE (entity_type, entity_id);

-- Add index for fast lookups by entity_type and entity_id
CREATE INDEX IF NOT EXISTS idx_location_seo_entity 
ON location_seo_overrides(entity_type, entity_id);

-- Add trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_location_seo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_location_seo_updated_at
BEFORE UPDATE ON location_seo_overrides
FOR EACH ROW
EXECUTE FUNCTION update_location_seo_updated_at();
