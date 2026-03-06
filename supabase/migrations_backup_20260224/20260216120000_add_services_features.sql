-- Migration: Add services table enhancements for slug-based URLs and tracking
-- Date: 2026-02-16
-- Purpose: Ensure services table has all required fields for slug-based routing and view tracking

-- Add slug column if it doesn't exist
ALTER TABLE services
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add viewCount column if it doesn't exist
ALTER TABLE services
ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Add orderCount column if it doesn't exist
ALTER TABLE services
ADD COLUMN IF NOT EXISTS order_count INTEGER NOT NULL DEFAULT 0;

-- Ensure isActive column exists (may already exist)
ALTER TABLE services
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS services_slug_idx ON services(slug);
CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique ON services(slug);
CREATE INDEX IF NOT EXISTS services_view_count_idx ON services(view_count DESC);
CREATE INDEX IF NOT EXISTS services_order_count_idx ON services(order_count DESC);
CREATE INDEX IF NOT EXISTS services_active_idx ON services(is_active);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added services table enhancements';
END $$;
