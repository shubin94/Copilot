-- Add Blue Tick fields to detectives table
-- Blue Tick is a separate add-on subscription independent of the main package

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'detectives') THEN
    ALTER TABLE detectives ADD COLUMN IF NOT EXISTS has_blue_tick BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE detectives ADD COLUMN IF NOT EXISTS blue_tick_activated_at TIMESTAMP;
    
    -- Add comment explaining the fields
    COMMENT ON COLUMN detectives.has_blue_tick IS 'Indicates if detective has purchased Blue Tick verification badge';
    COMMENT ON COLUMN detectives.blue_tick_activated_at IS 'Timestamp when Blue Tick was first activated';
  END IF;
END $$;

-- Create index for Blue Tick lookups
CREATE INDEX IF NOT EXISTS idx_detectives_has_blue_tick 
  ON detectives(has_blue_tick) 
  WHERE has_blue_tick = true;
