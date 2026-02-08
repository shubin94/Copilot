-- Migration: Remove legacy subscription_plan column and enforce subscription_package_id
-- Date: 2026-02-06
-- Purpose: Eliminate dual subscription fields, establish single source of truth

BEGIN;

-- Step 1: Get the free plan ID
DO $$ DECLARE
  free_plan_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM subscription_plans 
  WHERE name = 'free' AND monthly_price = 0 AND is_active = true 
  ORDER BY name ASC
  LIMIT 1;
  
  IF free_plan_id IS NULL THEN
    RAISE EXCEPTION 'Free plan not found in subscription_plans table!';
  END IF;

  -- Step 2: Assign free plan to detectives with NULL subscription_package_id (both active and inactive)
  UPDATE detectives 
  SET subscription_package_id = free_plan_id
  WHERE subscription_package_id IS NULL;
  
  -- Log the change
  RAISE NOTICE 'Assigned free plan to detectives with NULL subscription_package_id';
END $$;

-- Step 3: Drop the legacy subscription_plan column
-- This is the permanent fix - no longer two sources of truth
ALTER TABLE detectives DROP COLUMN subscription_plan;

-- Step 4: Make subscription_package_id NOT NULL with foreign key
ALTER TABLE detectives 
  ALTER COLUMN subscription_package_id SET NOT NULL;

-- Step 5: Add foreign key constraint if it doesn't exist
DO $$ BEGIN
  ALTER TABLE detectives
  ADD CONSTRAINT fk_detectives_subscription_package
  FOREIGN KEY (subscription_package_id) REFERENCES subscription_plans(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists
  RAISE NOTICE 'Foreign key constraint already exists';
END $$;

-- Verification: Confirm no detectives have NULL subscription_package_id
DO $$ DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count FROM detectives WHERE subscription_package_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'ERROR: % detectives still have NULL subscription_package_id!', null_count;
  END IF;
  RAISE NOTICE 'Verification passed: All detectives have valid subscription_package_id';
END $$;

COMMIT;
