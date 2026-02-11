import { Pool } from 'pg';

const pool = new Pool({
  host: '127.0.0.1',
  port: 54322,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

async function runExplainAnalyze() {
  try {
    console.log('Connecting to database: postgresql://postgres:***@127.0.0.1:54322/postgres\n');

    // TEST 1: Simple popularity query
    console.log('========================================================================');
    console.log('TEST 1: Simple Popularity Query');
    console.log('========================================================================');
    console.log('SQL:');
    console.log('SELECT id FROM services WHERE is_active = true ORDER BY order_count DESC LIMIT 20;\n');
    
    const test1 = await pool.query(`
      EXPLAIN ANALYZE
      SELECT id
      FROM services
      WHERE is_active = true
      ORDER BY order_count DESC
      LIMIT 20;
    `);

    console.log('EXPLAIN ANALYZE OUTPUT:');
    test1.rows.forEach(row => console.log(row['QUERY PLAN']));
    console.log('\n');

    // TEST 2: Full search query
    console.log('========================================================================');
    console.log('TEST 2: Full Search Query (sortBy=popular)');
    console.log('========================================================================');
    console.log('SQL:');
    console.log(`SELECT
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
  r.avg_rating,
  r.review_count
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
ORDER BY s.order_count DESC
LIMIT 20;\n`);

    const test2 = await pool.query(`
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
        r.avg_rating,
        r.review_count
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
      ORDER BY s.order_count DESC
      LIMIT 20;
    `);

    console.log('EXPLAIN ANALYZE OUTPUT:');
    test2.rows.forEach(row => console.log(row['QUERY PLAN']));
    console.log('\n');

    await pool.end();
    console.log('========================================================================');
    console.log('Tests complete.');
    console.log('========================================================================');
  } catch (error) {
    console.error('DATABASE ERROR:', error.message);
    console.error('Details:', error);
    await pool.end();
    process.exit(1);
  }
}

runExplainAnalyze();
