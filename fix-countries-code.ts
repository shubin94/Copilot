import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function fixCountries() {
  try {
    console.log('1️⃣ Checking countries table schema...');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'countries'
      ORDER BY ordinal_position
    `);
    
    const hasCodeColumn = schemaResult.rows.some(r => r.column_name === 'code');
    console.log(`Columns: ${schemaResult.rows.map(r => r.column_name).join(', ')}`);
    console.log(`Has 'code' column: ${hasCodeColumn ? '✅ YES' : '❌ NO'}`);

    // Add code column if it doesn't exist
    if (!hasCodeColumn) {
      console.log('\n2️⃣ Adding code column...');
      await pool.query(`
        ALTER TABLE countries 
        ADD COLUMN code VARCHAR(10)
      `);
      console.log('✅ Code column added');
    } else {
      console.log('\n2️⃣ Code column already exists');
    }

    // Populate with country codes
    console.log('\n3️⃣ Populating country codes...');
    const countryMap = {
      'India': 'IN',
      'United States': 'US',
      'United Kingdom': 'GB',
      'Australia': 'AU',
      'Canada': 'CA',
    };

    for (const [name, code] of Object.entries(countryMap)) {
      await pool.query(
        `UPDATE countries SET code = $1 WHERE name = $2`,
        [code, name]
      );
      console.log(`  ✓ ${name} → ${code}`);
    }

    // Verify
    console.log('\n4️⃣ Verifying...');
    const verifyResult = await pool.query(`
      SELECT id, name, code, slug FROM countries ORDER BY name
    `);
    console.log(`Found ${verifyResult.rows.length} countries with codes`);
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.code})`);
    });

    // Test sitemap query
    console.log('\n5️⃣ Testing sitemap JOIN query...');
    const sitemapTest = await pool.query(`
      SELECT DISTINCT 
        c.name, c.code, c.slug,
        COUNT(d.id) as detective_count
      FROM countries c
      LEFT JOIN detectives d ON d.country = c.code AND d.status = 'active'
      GROUP BY c.name, c.code, c.slug
      HAVING COUNT(d.id) > 0
    `);
    
    console.log(`✅ Sitemap query works! Found ${sitemapTest.rows.length} countries with detectives:`);
    sitemapTest.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.code}): ${row.detective_count} detectives`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixCountries();
