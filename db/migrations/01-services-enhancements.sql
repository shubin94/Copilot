-- Migration: 01-services-enhancements.sql
-- Date: 2026-02-16
-- Purpose: Add services table columns for slug-based URLs and view tracking
-- Status: IDEMPOTENT (uses IF NOT EXISTS)

-- Add slug column if it doesn't exist
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add viewCount column if it doesn't exist
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add orderCount column if it doesn't exist
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;

-- Ensure isActive column exists with proper default
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes for optimal performance (idempotent)
CREATE INDEX IF NOT EXISTS services_slug_idx ON services(slug);
CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique ON services(slug);
CREATE INDEX IF NOT EXISTS services_view_count_idx ON services(view_count DESC);
CREATE INDEX IF NOT EXISTS services_order_count_idx ON services(order_count DESC);
CREATE INDEX IF NOT EXISTS services_active_idx ON services(is_active);
