import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: './.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Local development - no SSL
});

async function seedCountries() {
  try {
    // List of country codes used in active detectives
    const countryCodes = [
      { code: 'IN', name: 'India', slug: 'india' },
      { code: 'US', name: 'United States', slug: 'united-states' },
      { code: 'GB', name: 'United Kingdom', slug: 'united-kingdom' },
      { code: 'AU', name: 'Australia', slug: 'australia' },
      { code: 'CA', name: 'Canada', slug: 'canada' },
    ];

    console.log('📍 Seeding countries table...');
    console.log('Database URL:', process.env.DATABASE_URL);

    for (const country of countryCodes) {
      try {
        const id = `c-${country.slug}`;
        const result = await pool.query(
          `INSERT INTO countries (id, code, name, slug, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (code) DO UPDATE SET slug = $5`,
          [id, country.code, country.name, country.slug, country.slug]
        );
        console.log(`  ✓ ${country.name} (${country.code})`);
      } catch (err) {
        console.error(`  ✗ Failed to seed ${country.name}:`, (err as any).message);
      }
    }

    // Verify
    const result = await pool.query(`SELECT COUNT(*) as count FROM countries`);
    const count = result.rows[0].count;
    console.log(`\n✅ Countries table now has ${count} entries`);

    // Check if sitemap query would work now
    const sitemapTest = await pool.query(`
      SELECT c.name, COUNT(d.id) as detective_count
      FROM countries c
      LEFT JOIN detectives d ON d.country = c.code AND d.status = 'active'
      GROUP BY c.name
      HAVING COUNT(d.id) > 0
    `);
    
    console.log(`\n📊 Countries with active detectives:`);
    sitemapTest.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.detective_count} detectives`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seedCountries();
