-- Migration: Convert subscription_plan from enum to text
-- This allows dynamic package creation by admin

-- Step 1: Add temporary text columns
ALTER TABLE detectives ADD COLUMN subscription_plan_text TEXT;

-- Step 2: Copy data from enum column to text column
UPDATE detectives SET subscription_plan_text = subscription_plan::TEXT;

-- Step 3: Drop the old enum column
ALTER TABLE detectives DROP COLUMN subscription_plan;

-- Step 4: Rename text column to original name
ALTER TABLE detectives RENAME COLUMN subscription_plan_text TO subscription_plan;

-- Step 5: Add NOT NULL and default constraints
ALTER TABLE detectives ALTER COLUMN subscription_plan SET NOT NULL;
ALTER TABLE detectives ALTER COLUMN subscription_plan SET DEFAULT 'free';

-- Step 6: Drop the enum type (only if not used elsewhere)
DROP TYPE IF EXISTS subscription_plan;

-- Step 7: Recreate indexes
DROP INDEX IF EXISTS detectives_plan_idx;
CREATE INDEX detectives_plan_idx ON detectives(subscription_plan);
