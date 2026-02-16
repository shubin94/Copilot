-- Add slug, view_count, order_count, and is_active columns to services table
-- These enable slug-based routing, view tracking, and service limit management

-- Add slug column (unique, nullable until populated)
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add view count for tracking service views (defaults to 0)
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add order count for tracking orders (defaults to 0)
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;

-- Add is_active column for service availability (defaults to true, soft delete alternative)
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS services_slug_idx ON services(slug);
CREATE INDEX IF NOT EXISTS services_view_count_idx ON services(view_count DESC);
CREATE INDEX IF NOT EXISTS services_order_count_idx ON services(order_count DESC);
CREATE INDEX IF NOT EXISTS services_active_idx ON services(is_active);
