/**
 * Check if services have slugs populated
 */

import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function checkServiceSlugs() {
  console.log('🔍 Checking service slugs in production database...\n');
  
  // Check total services
  const totalResult = await pool.query('SELECT COUNT(*) as count FROM services');
  const total = parseInt(totalResult.rows[0].count);
  console.log(`📊 Total services: ${total}`);
  
  // Check how many have slugs
  const withSlugsResult = await pool.query('SELECT COUNT(*) as count FROM services WHERE slug IS NOT NULL AND slug != \'\'');
  const withSlugs = parseInt(withSlugsResult.rows[0].count);
  console.log(`✅ Services with slugs: ${withSlugs}`);
  console.log(`❌ Services WITHOUT slugs: ${total - withSlugs}\n`);
  
  // Show sample services
  const samplesResult = await pool.query(`
    SELECT id, title, slug, detective_id 
    FROM services 
    LIMIT 10
  `);
  
  console.log('📋 Sample services:');
  console.log('='.repeat(80));
  for (const row of samplesResult.rows) {
    console.log(`Service: ${row.title}`);
    console.log(`  Slug: ${row.slug || '❌ MISSING'}`);
    console.log(`  ID: ${row.id}`);
    console.log('');
  }
  
  // Check the specific slug the user is looking for
  console.log('🔎 Looking for specific service slug: security-consulting-services\n');
  const specificResult = await pool.query(`
    SELECT s.id, s.title, s.slug, d.business_name, d.slug as detective_slug
    FROM services s
    LEFT JOIN detectives d ON s.detective_id = d.id
    WHERE s.slug = $1
  `, ['security-consulting-services']);
  
  if (specificResult.rows.length > 0) {
    console.log('✅ Found service:');
    console.log(specificResult.rows[0]);
  } else {
    console.log('❌ Service with slug "security-consulting-services" NOT FOUND');
    
    // Try to find similar services
    console.log('\n🔎 Looking for services with similar titles...\n');
    const similarResult = await pool.query(`
      SELECT s.id, s.title, s.slug, s.category
      FROM services s
      WHERE s.title ILIKE '%security%' OR s.title ILIKE '%consulting%'
      LIMIT 5
    `);
    
    if (similarResult.rows.length > 0) {
      console.log('Similar services found:');
      for (const row of similarResult.rows) {
        console.log(`  - ${row.title} (slug: ${row.slug || 'NO SLUG'}, category: ${row.category})`);
      }
    }
  }
  
  await pool.end();
}

checkServiceSlugs().catch(console.error);
