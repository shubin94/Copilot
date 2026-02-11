-- Migration: Add indexes for search performance
-- Purpose: Eliminate full table scans on location-based queries
-- Date: 2026-02-10

-- Index for /api/locations/countries endpoint (filterby status)
CREATE INDEX IF NOT EXISTS idx_detectives_status
ON public.detectives(status)
WHERE status = 'active';

-- Composite index for /api/locations/states endpoint (filter by status + country)
CREATE INDEX IF NOT EXISTS idx_detectives_status_country
ON public.detectives(status, country)
WHERE status = 'active';

-- Composite index for /api/locations/cities endpoint (filter by status + country + state)
CREATE INDEX IF NOT EXISTS idx_detectives_status_country_state
ON public.detectives(status, country, state)
WHERE status = 'active';

-- Composite index for searchServices location filtering (status + country + state + city)
CREATE INDEX IF NOT EXISTS idx_detectives_status_country_state_city
ON public.detectives(status, country, state, city)
WHERE status = 'active';

-- Index on reviews for serviceId to support aggregation subquery
CREATE INDEX IF NOT EXISTS idx_reviews_service_id_published
ON public.reviews(service_id, is_published)
WHERE is_published = TRUE;
