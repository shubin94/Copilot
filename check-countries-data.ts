import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function checkCountries() {
  try {
    const result = await pool.query(`SELECT * FROM countries`);
    console.log(`Total countries in table: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log('\nAll countries:');
      result.rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`  Name: ${row.name}`);
        console.log(`  ISO Code: ${row.iso_code}`);
        console.log(`  Slug: ${row.slug}`);
        console.log(`  Code (new): ${row.code}`);
        console.log('---');
      });
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCountries();
