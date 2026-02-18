import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'countries'
      ORDER BY ordinal_position
    `);
    
    console.log('Countries table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check sample data
    const dataResult = await pool.query('SELECT * FROM countries LIMIT 1');
    if (dataResult.rows.length > 0) {
      console.log('\nSample row:');
      console.log(JSON.stringify(dataResult.rows[0], null, 2));
    } else {
      console.log('\nCountries table is empty');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
