import pkg from "pg";
import { loadEnv } from "./server/lib/loadEnv.ts";

const { Pool } = pkg;

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false
});

async function checkTables() {
  try {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    console.log('\n📋 Tables in live database:\n');
    rows.forEach(r => console.log('  ' + r.table_name));
    
    // Check if detective_visibility exists
    const detVis = rows.find(r => r.table_name === 'detective_visibility');
    if (detVis) {
      console.log('\n✅ detective_visibility table EXISTS');
      const columns = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='detective_visibility' ORDER BY ordinal_position`
      );
      console.log('\nColumns:');
      columns.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
    } else {
      console.log('\n❌ detective_visibility table MISSING');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
