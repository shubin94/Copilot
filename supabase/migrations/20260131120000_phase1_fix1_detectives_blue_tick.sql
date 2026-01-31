-- Phase 1 Fix #1: Detectives blue-tick schema alignment
-- Scope: public.detectives only. No other tables. No application code changes.
-- Idempotent: safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- Existing rows receive DEFAULT values for NOT NULL columns; no NULL violations.

-- 1. blue_tick_addon: purchased add-on; independent of subscription; never cleared by entitlements
ALTER TABLE public.detectives
  ADD COLUMN IF NOT EXISTS blue_tick_addon boolean NOT NULL DEFAULT false;

-- 2. blue_tick_activated_at: when Blue Tick was activated (nullable)
ALTER TABLE public.detectives
  ADD COLUMN IF NOT EXISTS blue_tick_activated_at timestamp with time zone;

-- 3. has_blue_tick: subscription-granted badge (synced from package); distinct from add-on
ALTER TABLE public.detectives
  ADD COLUMN IF NOT EXISTS has_blue_tick boolean NOT NULL DEFAULT false;
