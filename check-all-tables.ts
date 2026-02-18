import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: 5432,
});

async function checkTables() {
  try {
    // List all tables
    const tableResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log("All tables in database:");
    tableResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check if countries table exists
    if (tableResult.rows.some(r => r.table_name === 'countries')) {
      console.log("\n✅ Countries table EXISTS");
      
      // Get its columns
      const colResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'countries'
        ORDER BY ordinal_position
      `);
      
      console.log("\nCountries table columns:");
      colResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log("\n❌ Countries table DOES NOT EXIST");
    }
    
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTables().catch(console.error);
