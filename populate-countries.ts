import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function populateCountries() {
  try {
    console.log('📍 Populating countries table...');
    
    // Country data: iso_code, name, slug
    const countries = [
      { iso_code: 'IN', name: 'India', slug: 'india' },
      { iso_code: 'US', name: 'United States', slug: 'united-states' },
      { iso_code: 'GB', name: 'United Kingdom', slug: 'united-kingdom' },
      { iso_code: 'AU', name: 'Australia', slug: 'australia' },
      { iso_code: 'CA', name: 'Canada', slug: 'canada' },
    ];

    for (const country of countries) {
      await pool.query(
        `INSERT INTO countries (name, iso_code, slug, code)
         VALUES ($1, $2, $3, $4)`,
        [country.name, country.iso_code, country.slug, country.iso_code]
      );
      console.log(`  ✓ ${country.name} (${country.iso_code})`);
    }

    // Verify
    console.log('\n✅ Verification:');
    const result = await pool.query(`
      SELECT iso_code, code, name, slug FROM countries ORDER BY name
    `);
    console.log(`Found ${result.rows.length} countries:`);
    result.rows.forEach(row => {
      console.log(`  - ${row.name}: iso_code=${row.iso_code}, code=${row.code}`);
    });

    // Test sitemap query using code column
    console.log('\n🔍 Testing sitemap query with JOIN on code:');
    const sitemapTest = await pool.query(`
      SELECT DISTINCT 
        c.name, c.code, c.slug,
        COUNT(d.id) as detective_count
      FROM countries c
      LEFT JOIN detectives d ON d.country = c.code AND d.status = 'active'
      GROUP BY c.name, c.code, c.slug
      HAVING COUNT(d.id) > 0
      ORDER BY detective_count DESC
    `);
    
    if (sitemapTest.rows.length > 0) {
      console.log(`✅ Found ${sitemapTest.rows.length} countries with active detectives:`);
      sitemapTest.rows.forEach(row => {
        console.log(`  - ${row.name}: ${row.detective_count} detectives`);
      });
    } else {
      console.log('⚠️  No countries with detectives found');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

populateCountries();
