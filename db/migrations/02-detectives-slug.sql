-- Migration: 02-detectives-slug.sql
-- Date: 2026-02-16
-- Purpose: Add slug column to detectives table for SEO-friendly URLs
-- Status: IDEMPOTENT (uses IF NOT EXISTS)

-- Add slug column if it doesn't exist
ALTER TABLE IF EXISTS detectives ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create indexes for optimal performance (idempotent)
CREATE INDEX IF NOT EXISTS detectives_slug_idx ON detectives(slug);
CREATE UNIQUE INDEX IF NOT EXISTS detectives_slug_unique ON detectives(slug);
