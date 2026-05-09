-- Category-filtered recent query functional composite index
--
-- Targets storage.searchServices() Drizzle ORM else-branch query shape:
--   WHERE s.is_active = true
--     AND s.images IS NOT NULL
--     AND array_length(s.images, 1) > 0
--     AND lower(s.category) = lower($1)   ← functional predicate, case-insensitive
--   ORDER BY s.created_at DESC
--   LIMIT $limit OFFSET $offset
--
-- Problem:
--   The existing btree indexes on (category) and (category, is_active) store the raw
--   column value.  A predicate of the form lower(category) = '...' applies a function
--   to the left-hand side, so PostgreSQL cannot use a plain btree index on category to
--   satisfy it.  This forces a sequential scan of the entire services table followed by
--   a post-scan quicksort on every category+recent request.
--
-- Fix:
--   A functional (expression) index on lower(category) allows the planner to perform
--   an index scan — looking up exactly the matching category bucket — and the second
--   key column (created_at DESC) lets the index return rows already in result order,
--   eliminating the post-scan sort.  With LIMIT 15, the planner stops after reading
--   15 index entries without touching any other rows.
--
-- Partial predicate (WHERE clause) mirrors the partial index already used by the
-- unfiltered-recent index (0039) so that:
--   - The index footprint is smaller (excludes inactive / image-less services)
--   - The partial conditions are already present in every category query's WHERE clause
--   - The planner can use the partial index without extra filter steps
--
-- Safe strategy:
--   CREATE INDEX CONCURRENTLY never acquires a table lock.
--   IF NOT EXISTS makes the statement idempotent (safe to re-run).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_category_lower_recent
ON services (lower(category), created_at DESC)
WHERE is_active = true
  AND images IS NOT NULL
  AND array_length(images, 1) > 0;

-- Rollback:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_services_category_lower_recent;
