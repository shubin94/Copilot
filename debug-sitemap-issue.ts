import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: 5432,
});

async function debug() {
  try {
    // Check 1: Does countries table exist and what columns does it have?
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'countries'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== COUNTRIES TABLE SCHEMA ===');
    if (tableCheck.rows.length === 0) {
      console.log('❌ Countries table DOES NOT EXIST or has no columns');
    } else {
      console.log('✅ Countries table schema:');
      tableCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    }

    // Check 2: Sample data from countries table
    console.log('\n=== SAMPLE COUNTRIES DATA ===');
    const countriesData = await pool.query('SELECT id, iso_code, code, name, slug FROM countries LIMIT 3');
    console.log(`Found ${countriesData.rows.length} countries:`);
    countriesData.rows.forEach(row => {
      console.log(`  ${JSON.stringify(row)}`);
    });

    // Check 3: Detective data - country field
    console.log('\n=== DETECTIVES COUNTRY VALUES ===');
    const detectivesData = await pool.query(`
      SELECT DISTINCT country, COUNT(*) as count 
      FROM detectives 
      WHERE status = 'active' 
      GROUP BY country
    `);
    console.log(`Found ${detectivesData.rows.length} distinct active detective countries:`);
    detectivesData.rows.forEach(row => {
      console.log(`  ${row.country}: ${row.count} detectives`);
    });

    // Check 4: Test the JOIN
    console.log('\n=== TEST SQL JOIN ===');
    const joinTest = await pool.query(`
      SELECT DISTINCT 
        c.id,
        c.iso_code,
        c.code,
        c.name,
        COUNT(d.id) as detective_count
      FROM countries c
      LEFT JOIN detectives d ON d.country = c.iso_code AND d.status = 'active'
      GROUP BY c.id, c.iso_code, c.code, c.name
      HAVING COUNT(d.id) > 0
    `);
    console.log(`Countries with active detectives (iso_code match): ${joinTest.rows.length}`);
    joinTest.rows.forEach(row => {
      console.log(`  ${row.iso_code}: ${row.name} (${row.detective_count} detectives)`);
    });

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

debug().catch(console.error);
