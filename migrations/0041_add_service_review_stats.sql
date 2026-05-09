-- Additive precomputed review stats for services search path optimization.
-- This removes live aggregation pressure from /api/services by persisting published-review stats.

ALTER TABLE services
ADD COLUMN IF NOT EXISTS review_avg numeric(4,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

-- Backfill current stats from published reviews.
UPDATE services s
SET
  review_avg = COALESCE(stats.avg_rating, 0),
  review_count = COALESCE(stats.review_count, 0)
FROM (
  SELECT
    r.service_id,
    ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) AS avg_rating,
    COUNT(r.id)::int AS review_count
  FROM reviews r
  WHERE r.is_published = true
  GROUP BY r.service_id
) stats
WHERE s.id = stats.service_id;

-- Ensure services with no published reviews are normalized to zero.
UPDATE services
SET
  review_avg = 0,
  review_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM reviews r
  WHERE r.service_id = services.id
    AND r.is_published = true
);

-- Recompute helper used by trigger on review mutations.
CREATE OR REPLACE FUNCTION refresh_service_review_stats(target_service_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE services s
  SET
    review_avg = COALESCE(stats.avg_rating, 0),
    review_count = COALESCE(stats.review_count, 0)
  FROM (
    SELECT
      ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) AS avg_rating,
      COUNT(r.id)::int AS review_count
    FROM reviews r
    WHERE r.service_id = target_service_id
      AND r.is_published = true
  ) stats
  WHERE s.id = target_service_id;
END;
$$;

CREATE OR REPLACE FUNCTION reviews_refresh_service_stats_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_service_review_stats(NEW.service_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.service_id IS DISTINCT FROM NEW.service_id THEN
      PERFORM refresh_service_review_stats(OLD.service_id);
    END IF;
    PERFORM refresh_service_review_stats(NEW.service_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_service_review_stats(OLD.service_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_refresh_service_stats ON reviews;
CREATE TRIGGER reviews_refresh_service_stats
AFTER INSERT OR UPDATE OF rating, is_published, service_id OR DELETE
ON reviews
FOR EACH ROW
EXECUTE FUNCTION reviews_refresh_service_stats_trigger();

-- Rollback guide (manual):
-- DROP TRIGGER IF EXISTS reviews_refresh_service_stats ON reviews;
-- DROP FUNCTION IF EXISTS reviews_refresh_service_stats_trigger();
-- DROP FUNCTION IF EXISTS refresh_service_review_stats(text);
-- ALTER TABLE services DROP COLUMN IF EXISTS review_count;
-- ALTER TABLE services DROP COLUMN IF EXISTS review_avg;
