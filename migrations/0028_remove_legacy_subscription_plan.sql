-- Migration: Remove legacy subscription_plan column and enforce subscription_package_id
-- Date: 2026-02-06
-- Purpose: Eliminate dual subscription fields, establish single source of truth
-- IDEMPOTENT: Safe to run multiple times, handles missing columns/tables gracefully

DO $$ DECLARE
  free_plan_id uuid;
  null_count integer;
BEGIN
  -- Only proceed if detectives table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'detectives') THEN
    
    -- Step 1: Get the free plan ID
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_plans') THEN
      SELECT id INTO free_plan_id FROM subscription_plans 
      WHERE name = 'free' AND monthly_price = 0 AND is_active = true 
      ORDER BY name ASC
      LIMIT 1;
      
      IF free_plan_id IS NOT NULL THEN
        -- Step 2: Assign free plan to detectives with NULL subscription_package_id
        UPDATE detectives 
        SET subscription_package_id = free_plan_id
        WHERE subscription_package_id IS NULL;
      END IF;
    END IF;
    
    -- Step 3: Drop the legacy subscription_plan column (only if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'detectives' AND column_name = 'subscription_plan') THEN
      ALTER TABLE detectives DROP COLUMN subscription_plan;
    END IF;
    
    -- Step 4: Make subscription_package_id NOT NULL (if subscription_package_id exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'detectives' AND column_name = 'subscription_package_id') THEN
      ALTER TABLE detectives ALTER COLUMN subscription_package_id SET NOT NULL;
      
      -- Step 5: Add foreign key constraint if it doesn't exist
      BEGIN
        ALTER TABLE detectives
        ADD CONSTRAINT fk_detectives_subscription_package
        FOREIGN KEY (subscription_package_id) REFERENCES subscription_plans(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN
        -- Constraint already exists, continue
        NULL;
      END;
    END IF;
  END IF;
END $$;
