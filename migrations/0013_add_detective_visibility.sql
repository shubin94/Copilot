-- Create detective_visibility table for ranking & visibility control
CREATE TABLE IF NOT EXISTS detective_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detective_id VARCHAR NOT NULL UNIQUE REFERENCES detectives(id) ON DELETE CASCADE,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  manual_rank INTEGER DEFAULT NULL,
  visibility_score FLOAT NOT NULL DEFAULT 0,
  last_evaluated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_detective_visibility_is_visible ON detective_visibility(is_visible);
CREATE INDEX IF NOT EXISTS idx_detective_visibility_manual_rank ON detective_visibility(manual_rank);
CREATE INDEX IF NOT EXISTS idx_detective_visibility_visibility_score ON detective_visibility(visibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_detective_visibility_is_featured ON detective_visibility(is_featured);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_detective_visibility_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_detective_visibility_updated_at'
  ) THEN
    CREATE TRIGGER trigger_detective_visibility_updated_at
    BEFORE UPDATE ON detective_visibility
    FOR EACH ROW
    EXECUTE FUNCTION update_detective_visibility_timestamp();
  END IF;
END $$;
