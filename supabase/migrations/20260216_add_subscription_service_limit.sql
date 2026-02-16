-- Migration: Add subscription plans enhancements
-- Date: 2026-02-16
-- Purpose: Ensure subscription_plans table has serviceLimit for managing detective service limits

-- Add serviceLimit column if it doesn't exist
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS service_limit INTEGER NOT NULL DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS subscription_plans_service_limit_idx ON subscription_plans(service_limit);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added subscription_plans service_limit column';
END $$;
