import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: "postgresql://postgres.gjgrwxxtkyggwfrydpdb:AKshubin123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

const query = `
EXPLAIN ANALYZE
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
  AVG(r.rating)::numeric as avg_rating,
  COUNT(r.id) as review_count,
  d.detective_id_check,
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
  d.visibility_score,
  d.is_featured,
  u.email
FROM (
  SELECT d.id as detective_id_check, d.user_id, d.business_name, d.bio, d.logo, d.location, d.slug, 
         d.country, d.state, d.city, d.phone, d.whatsapp, d.contact_email, 
         d.status, d.is_verified, d.level,
         COALESCE(dv.visibility_score, 0) as visibility_score, 
         COALESCE(dv.is_featured, false) as is_featured
  FROM detectives d
  LEFT JOIN detective_visibility dv ON d.id = dv.detective_id
  WHERE d.status = 'active'
  ORDER BY visibility_score DESC NULLS LAST
  LIMIT 8
) d
JOIN users u ON d.user_id = u.id
LEFT JOIN LATERAL (
  SELECT s.id, s.detective_id, s.title, s.category, s.description, s.images,
         s.base_price, s.offer_price, s.is_on_enquiry, s.order_count, s.updated_at
  FROM services s
  WHERE s.detective_id = d.detective_id_check
    AND s.is_active = true
    AND s.images IS NOT NULL
    AND s.images::text[] != '{}'::text[]
  ORDER BY s.order_count DESC, s.updated_at DESC
  LIMIT 1
) s ON true
LEFT JOIN reviews r ON s.id = r.service_id
GROUP BY 
  s.id, s.detective_id, s.title, s.category, s.description, s.images,
  s.base_price, s.offer_price, s.is_on_enquiry, s.order_count, s.updated_at,
  d.detective_id_check, d.user_id, d.business_name, d.bio, d.logo, d.location, d.slug,
  d.country, d.state, d.city, d.phone, d.whatsapp, d.contact_email, d.status,
  d.is_verified, d.level, d.visibility_score, d.is_featured, u.email
`;

async function runExplainAnalyze() {
  try {
    console.log("Running EXPLAIN ANALYZE with new index...\n");
    const result = await pool.query(query);
    console.log("EXPLAIN ANALYZE OUTPUT:\n");
    result.rows.forEach(row => {
      console.log(row["QUERY PLAN"]);
    });
    
    // Show index stats
    console.log("\n\n📊 INDEX STATISTICS:");
    const indexStats = await pool.query(`
      SELECT 
        indexrelname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE indexrelname = 'idx_services_lateral_lookup';
    `);
    
    if (indexStats.rows.length > 0) {
      const stat = indexStats.rows[0];
      console.log(`Index: ${stat.indexrelname}`);
      console.log(`  Scans: ${stat.idx_scan}`);
      console.log(`  Tuples Read: ${stat.idx_tup_read}`);
      console.log(`  Tuples Fetched: ${stat.idx_tup_fetch}`);
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

runExplainAnalyze();
