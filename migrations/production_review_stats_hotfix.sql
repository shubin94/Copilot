-- Production hotfix: create missing review stats schema objects for services.
-- Safe to run multiple times (idempotent).

BEGIN;

ALTER TABLE services
ADD COLUMN IF NOT EXISTS review_avg numeric(4,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

-- Backfill for all services using published reviews only.
UPDATE services s
SET
  review_avg = COALESCE(stats.avg_rating, 0),
  review_count = COALESCE(stats.review_count, 0)
FROM (
  SELECT
    sv.id AS service_id,
    ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) AS avg_rating,
    COUNT(r.id)::int AS review_count
  FROM services sv
  LEFT JOIN reviews r
    ON r.service_id = sv.id
   AND r.is_published = true
  GROUP BY sv.id
) stats
WHERE s.id = stats.service_id;

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

COMMIT;
