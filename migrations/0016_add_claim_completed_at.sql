-- Step 4: Add claim completion tracking
-- Adds timestamp to track when claim process is finalized (after password change)
-- Used to ensure finalization only runs once per detective

ALTER TABLE detectives 
ADD COLUMN claim_completed_at TIMESTAMP;

-- Index for querying completed claims
CREATE INDEX detectives_claim_completed_at_idx ON detectives(claim_completed_at);
