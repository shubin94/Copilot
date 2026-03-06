-- Create composite index for LATERAL join optimization
-- Used in GET /api/services/featured/home endpoint
-- Covers: (detective_id, is_active) filter + (order_count DESC, updated_at DESC) sort
-- Allows index-only scan instead of Bitmap Heap Scan + Sort

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_lateral_lookup 
ON services (detective_id, is_active, order_count DESC, updated_at DESC)
WHERE images IS NOT NULL AND images <> '{}'::text[];
