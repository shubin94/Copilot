-- Migration: 03-subscription-plans-service-limit.sql
-- Date: 2026-02-16
-- Purpose: Add serviceLimit column to subscription_plans for managing detective service limits
-- Status: IDEMPOTENT (uses IF NOT EXISTS)

-- Add serviceLimit column if it doesn't exist
ALTER TABLE IF EXISTS subscription_plans ADD COLUMN IF NOT EXISTS service_limit INTEGER DEFAULT 0;

-- Create index for faster lookups (idempotent)
CREATE INDEX IF NOT EXISTS subscription_plans_service_limit_idx ON subscription_plans(service_limit);
