import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: 5432,
});

async function checkSchema() {
  try {
    // Check columns
    const colResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'countries'
      ORDER BY ordinal_position
    `);
    
    console.log("Countries table columns:");
    colResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    // Check sample data
    console.log("\nSample countries data:");
    const dataResult = await pool.query('SELECT * FROM countries LIMIT 3');
    console.log(JSON.stringify(dataResult.rows, null, 2));
    
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
