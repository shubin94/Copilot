EXPLAIN ANALYZE
WITH ranked_services AS (
  SELECT 
    s.id,
    s.detective_id,
    s.title,
    s.category,
    s.description,
    s.images,
    s.base_price,
    s.offer_price,
    s.is_on_enquiry,
    s.order_count,
    s.updated_at,
    ROW_NUMBER() OVER (PARTITION BY s.detective_id ORDER BY s.order_count DESC, s.updated_at DESC) as rn
  FROM services s
  WHERE s.is_active = true
    AND s.images IS NOT NULL 
    AND s.images::text[] != '{}'::text[]
),
unique_detective_services AS (
  SELECT * FROM ranked_services WHERE rn = 1
)
SELECT 
  us.id,
  us.detective_id,
  us.title,
  us.category,
  us.description,
  us.images,
  us.base_price,
  us.offer_price,
  us.is_on_enquiry,
  us.order_count,
  us.updated_at,
  AVG(r.rating)::numeric as avg_rating,
  COUNT(r.id) as review_count,
  d.id as detective_id_check,
  d.user_id,
  d.business_name,
  d.bio,
  d.logo,
  d.location,
  d.slug,
  d.country,
  d.state,
  d.city,
  d.phone,
  d.whatsapp,
  d.contact_email,
  d.status,
  d.is_verified,
  d.level,
  dv.visibility_score,
  dv.is_featured,
  u.email
FROM unique_detective_services us
JOIN detectives d ON us.detective_id = d.id
LEFT JOIN detective_visibility dv ON d.id = dv.detective_id
JOIN users u ON d.user_id = u.id
LEFT JOIN reviews r ON us.id = r.service_id
WHERE d.status = 'active'
GROUP BY 
  us.id, us.detective_id, us.title, us.category, us.description, us.images, 
  us.base_price, us.offer_price, us.is_on_enquiry, us.order_count, us.updated_at,
  d.id, d.user_id, d.business_name, d.bio, d.logo, d.location, d.slug, 
  d.country, d.state, d.city, d.phone, d.whatsapp, d.contact_email, d.status, 
  d.is_verified, d.level, dv.visibility_score, dv.is_featured, u.email
ORDER BY dv.visibility_score DESC NULLS LAST, us.order_count DESC
LIMIT 8;
