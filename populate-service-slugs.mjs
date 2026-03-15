/**
 * Generate and populate slugs for all services in the database
 */

import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Same slug generation logic as your app
function generateSlug(text) {
  return text
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function populateServiceSlugs() {
  console.log('🔧 Populating slugs for all services...\n');
  
  // Get all services without slugs
  const servicesResult = await pool.query(`
    SELECT id, title, detective_id 
    FROM services 
    WHERE slug IS NULL OR slug = ''
  `);
  
  const services = servicesResult.rows;
  console.log(`📊 Found ${services.length} services without slugs\n`);
  
  if (services.length === 0) {
    console.log('✅ All services already have slugs!');
    await pool.end();
    return;
  }
  
  let updated = 0;
  let errors = 0;
  const slugCounts = new Map(); // Track slug usage for uniqueness
  
  for (const service of services) {
    try {
      // Generate base slug from title (no ID prefix)
      let baseSlug = generateSlug(service.title);

      // Ensure uniqueness
      let slug = baseSlug;
      let counter = slugCounts.get(baseSlug) || 0;

      if (counter > 0) {
        slug = `${baseSlug}-${counter}`;
      }

      slugCounts.set(baseSlug, counter + 1);

      // Update the service with clean slug only
      await pool.query(
        'UPDATE services SET slug = $1, updated_at = NOW() WHERE id = $2',
        [slug, service.id]
      );
      
      updated++;
      
      if (updated % 20 === 0) {
        console.log(`✅ Updated ${updated}/${services.length}  services...`);
      }
    } catch (error) {
      console.error(`❌ Error updating service ${service.id}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Completed!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  
  // Show sample of generated slugs
  console.log('\n📋 Sample generated slugs:');
  const samplesResult = await pool.query(`
    SELECT title, slug 
    FROM services 
    WHERE slug IS NOT NULL 
    LIMIT 10
  `);
  
  for (const row of samplesResult.rows) {
    console.log(`  ${row.title}`);
    console.log(`    → ${row.slug}\n`);
  }
  
  // Check for the security consulting service
  console.log('🔎 Looking for security consulting service...');
  const securityResult = await pool.query(`
    SELECT title, slug
    FROM services
    WHERE title ILIKE '%security%consulting%'
    LIMIT 3
  `);
  
  if (securityResult.rows.length > 0) {    console.log('\n✅ Found security consulting services with new slugs:');
    for (const row of securityResult.rows) {
      console.log(`  - ${row.title}`);
      console.log(`    Slug: ${row.slug}\n`);
    }
  }
  
  await pool.end();
}

populateServiceSlugs().catch(console.error);
