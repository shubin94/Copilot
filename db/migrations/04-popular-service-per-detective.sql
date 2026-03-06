-- Migration: 04-popular-service-per-detective.sql
-- Date: 2026-02-20
-- Purpose: Create materialized view for 1 best service per detective (popular sort optimization)
-- Status: IDEMPOTENT (drop if exists then recreate)

-- Drop materialized view if it exists (handle any previous incomplete attempts)
DROP MATERIALIZED VIEW IF EXISTS popular_service_per_detective CASCADE;

-- Create materialized view: For each detective, select the 1 best service
-- Selected by: order_count DESC, updated_at DESC
-- Filters: is_active = true, images IS NOT NULL and not empty array
CREATE MATERIALIZED VIEW popular_service_per_detective AS
SELECT DISTINCT ON (s.detective_id)
  s.id AS service_id,
  s.detective_id,
  s.title,
  s.slug,
  s.category,
  s.description,
  s.images,
  s.base_price,
  s.offer_price,
  s.is_on_enquiry,
  s.is_active,
  s.order_count,
  s.view_count,
  s.created_at,
  s.updated_at
FROM services s
WHERE s.is_active = true
  AND s.images IS NOT NULL
  AND array_length(s.images, 1) > 0
ORDER BY s.detective_id, s.order_count DESC, s.updated_at DESC;

-- Create indexes on materialized view for optimal query performance
CREATE INDEX IF NOT EXISTS idx_popular_service_detective_id 
  ON popular_service_per_detective (detective_id);

CREATE INDEX IF NOT EXISTS idx_popular_service_order_count 
  ON popular_service_per_detective (order_count DESC);
