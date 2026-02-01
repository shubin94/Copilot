-- Fix schema mismatch: add blue_tick_addon and ensure blue_tick_activated_at exists
-- Safe for existing rows (DEFAULT false, nullable). Idempotent (IF NOT EXISTS).

-- 1. blue_tick_addon: BOOLEAN NOT NULL DEFAULT false
ALTER TABLE public.detectives
  ADD COLUMN IF NOT EXISTS blue_tick_addon boolean NOT NULL DEFAULT false;

-- 2. blue_tick_activated_at: TIMESTAMPTZ nullable (for existing rows, stays NULL)
ALTER TABLE public.detectives
  ADD COLUMN IF NOT EXISTS blue_tick_activated_at timestamp with time zone;

-- Optional: ensure has_blue_tick exists (code may expect it)
ALTER TABLE public.detectives
  ADD COLUMN IF NOT EXISTS has_blue_tick boolean NOT NULL DEFAULT false;
