-- Recent search path index alignment (safe additive change)
--
-- Targets storage.searchServices() default recent branch query shape:
--   WHERE s.is_active = true
--     AND s.images IS NOT NULL
--     AND array_length(s.images, 1) > 0
--   ORDER BY s.detective_id, s.created_at DESC, s.id DESC
--
-- This partial composite index aligns directly with DISTINCT ON working-set ordering,
-- reducing sort pressure before deduplication without changing query semantics.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_recent_distinct_detective_created
ON services (detective_id, created_at DESC, id DESC)
WHERE is_active = true
  AND images IS NOT NULL
  AND array_length(images, 1) > 0;

-- Rollback:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_services_recent_distinct_detective_created;