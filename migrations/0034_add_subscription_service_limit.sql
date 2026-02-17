-- Add service_limit column to subscription_plans table
-- This enables limiting the number of active services per subscription plan
-- When limit is reduced, lowest-performing services (by view count) are deactivated

-- Add service_limit column (how many services are allowed for this plan)
ALTER TABLE IF EXISTS subscription_plans ADD COLUMN IF NOT EXISTS service_limit INTEGER DEFAULT 0;

-- Create index for efficient lookups and filtering
CREATE INDEX IF NOT EXISTS subscription_plans_service_limit_idx ON subscription_plans(service_limit);
