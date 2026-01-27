-- UP Migration: Add partial index on reviews for published service ratings
-- This index speeds up rating aggregation queries in searchServices by filtering is_published=true at index level
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reviews_published_service_idx" 
ON "reviews" ("service_id") 
WHERE "is_published" = true;
--> statement-breakpoint

-- DOWN Migration: Remove the partial index
-- DROP INDEX CONCURRENTLY IF EXISTS "reviews_published_service_idx";
