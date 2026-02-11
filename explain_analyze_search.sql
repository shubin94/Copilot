-- ============================================================================
-- EXPLAIN ANALYZE: Search Page Performance (sortBy=popular)
-- Database: Local Supabase (postgresql://postgres:postgres@127.0.0.1:54322/postgres)
-- ============================================================================

-- TEST 1: Simple popularity query (should use idx_services_order_count_active)
EXPLAIN ANALYZE
SELECT id
FROM services
WHERE is_active = true
ORDER BY order_count DESC
LIMIT 20;

-- TEST 2: Full search query with all JOINs (as used in /search?sortBy=popular)
EXPLAIN ANALYZE
SELECT
  s.id,
  s.title,
  s.category,
  s.base_price,
  s.offer_price,
  s.is_on_enquiry,
  s.images,
  s.is_active,
  s.created_at,
  s.order_count,
  d.id,
  d.business_name,
  d.level,
  d.logo,
  d.country,
  d.location,
  d.phone,
  d.whatsapp,
  d.contact_email,
  d.is_verified,
  u.email,
  sp.name,
  COALESCE(AVG(r.rating), 0),
  COUNT(r.id)
FROM services s
LEFT JOIN detectives d ON s.detective_id = d.id
LEFT JOIN users u ON d.user_id = u.id
LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
LEFT JOIN (
  SELECT 
    service_id,
    COALESCE(AVG(rating), 0) as avg_rating,
    COUNT(id) as review_count
  FROM reviews
  WHERE is_published = true
  GROUP BY service_id
) r ON s.id = r.service_id
WHERE s.is_active = true
GROUP BY s.id, s.title, s.category, s.base_price, s.offer_price, s.is_on_enquiry, s.images, s.is_active, s.created_at, s.order_count, d.id, d.business_name, d.level, d.logo, d.country, d.location, d.phone, d.whatsapp, d.contact_email, d.is_verified, u.email, sp.name, r.avg_rating, r.review_count
ORDER BY s.order_count DESC
LIMIT 20;
