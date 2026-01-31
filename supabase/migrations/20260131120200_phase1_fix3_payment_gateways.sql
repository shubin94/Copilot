-- Phase 1 Fix #3: Create payment_gateways table
-- Scope: public.payment_gateways only. No other tables. No application code changes.
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- No RLS, no seed data, no triggers.

CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
