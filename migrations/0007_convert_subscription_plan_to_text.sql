-- Migration: Convert subscription_plan from enum to text
-- This allows dynamic package creation by admin
-- IDEMPOTENT: Safe to run multiple times, handles missing column/table gracefully

DO $$ BEGIN
  -- Only proceed if detectives table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'detectives') THEN
    
    -- Only proceed if subscription_plan column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'detectives' AND column_name = 'subscription_plan') THEN
      
      -- Check column data type
      IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'detectives' AND column_name = 'subscription_plan') != 'text' THEN
        
        -- Step 1: Add temporary text column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'detectives' AND column_name = 'subscription_plan_text') THEN
          ALTER TABLE detectives ADD COLUMN subscription_plan_text TEXT;
        END IF;
        
        -- Step 2: Copy data from enum column to text column
        UPDATE detectives SET subscription_plan_text = subscription_plan::TEXT WHERE subscription_plan_text IS NULL;
        
        -- Step 3: Drop the old enum column
        ALTER TABLE detectives DROP COLUMN subscription_plan;
        
        -- Step 4: Rename text column to original name
        ALTER TABLE detectives RENAME COLUMN subscription_plan_text TO subscription_plan;
        
      END IF;
      
      -- Step 5: Ensure NOT NULL and default constraints (idempotent)
      ALTER TABLE detectives ALTER COLUMN subscription_plan SET NOT NULL;
      ALTER TABLE detectives ALTER COLUMN subscription_plan SET DEFAULT 'free';
      
    END IF;
  END IF;
  
  -- Step 6: Drop the enum type (only if it exists and not used elsewhere)
  DROP TYPE IF EXISTS subscription_plan;
  
  -- Step 7: Recreate indexes (idempotent with DROP IF EXISTS)
  DROP INDEX IF EXISTS detectives_plan_idx;
  CREATE INDEX detectives_plan_idx ON detectives(subscription_plan);
  
END $$;
