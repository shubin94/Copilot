-- Fix subscription_plan column in customers table
-- Safe idempotent migration that handles all scenarios:
-- 1. Column doesn't exist -> create it
-- 2. Column exists as non-TEXT -> convert to TEXT
-- 3. Column already TEXT -> do nothing

DO $$ BEGIN
  -- Check if customers table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'customers'
  ) THEN
    -- Check if subscription_plan column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'customers' 
      AND column_name = 'subscription_plan'
    ) THEN
      -- Column doesn't exist, create it as TEXT
      ALTER TABLE customers ADD COLUMN subscription_plan TEXT;
    ELSE
      -- Column exists, check its data type
      IF (
        SELECT data_type FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'customers' 
        AND column_name = 'subscription_plan'
      ) != 'text' THEN
        -- Not TEXT, convert it
        ALTER TABLE customers ALTER COLUMN subscription_plan TYPE TEXT;
      END IF;
    END IF;
  END IF;
END $$;
