-- Add Blue Tick fields to detectives table
-- Blue Tick is a separate add-on subscription independent of the main package

BEGIN;

-- Add Blue Tick status field
ALTER TABLE detectives 
  ADD COLUMN IF NOT EXISTS has_blue_tick BOOLEAN NOT NULL DEFAULT false;

-- Add Blue Tick activation timestamp
ALTER TABLE detectives 
  ADD COLUMN IF NOT EXISTS blue_tick_activated_at TIMESTAMP;

-- Create index for Blue Tick lookups
CREATE INDEX IF NOT EXISTS idx_detectives_has_blue_tick 
  ON detectives(has_blue_tick) 
  WHERE has_blue_tick = true;

-- Add comment explaining the fields
COMMENT ON COLUMN detectives.has_blue_tick IS 'Indicates if detective has purchased Blue Tick verification badge';
COMMENT ON COLUMN detectives.blue_tick_activated_at IS 'Timestamp when Blue Tick was first activated';

COMMIT;
