import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `EXPLAIN ANALYZE
SELECT
  s.id as service_id,
  s.title,
  s.category,
  s.base_price,
  s.offer_price,
  s.is_on_enquiry,
  (s.images)[1] as service_main_image,
  s.order_count,
  d.id as detective_id,
  d.business_name,
  d.level,
  d.logo,
  d.country,
  d.state,
  d.city,
  d.slug,
  d.phone,
  d.whatsapp,
  d.contact_email,
  d.is_verified,
  d.subscription_package_id,
  d.subscription_expires_at,
  d.has_blue_tick,
  d.blue_tick_addon,
  sp.name as subscription_package_name,
  sp.badges as subscription_package_badges,
  r.avg_rating,
  r.review_count
FROM services s
LEFT JOIN detectives d ON s.detective_id = d.id
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
  AND s.images IS NOT NULL
  AND array_length(s.images, 1) > 0
ORDER BY s.order_count DESC
LIMIT 15 OFFSET 0;`;

await client.connect();
const res = await client.query(sql);
console.log(res.rows.map((row) => row["QUERY PLAN"]).join("\n"));
await client.end();
