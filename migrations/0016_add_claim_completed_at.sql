-- Step 4: Add claim completion tracking
-- Adds timestamp to track when claim process is finalized (after password change)
-- Used to ensure finalization only runs once per detective

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'detectives') THEN
    ALTER TABLE detectives ADD COLUMN IF NOT EXISTS claim_completed_at TIMESTAMP;
  END IF;
END $$;

-- Index for querying completed claims
CREATE INDEX IF NOT EXISTS detectives_claim_completed_at_idx ON detectives(claim_completed_at);
