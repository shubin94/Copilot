-- Phase 1 Fix #4: CMS pages schema alignment
-- Scope: public.pages only. No other tables. No application code changes.
-- Idempotent: ADD COLUMN IF NOT EXISTS. All columns nullable; existing rows remain valid.

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS banner_image text;

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS meta_title text;

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS meta_description text;
