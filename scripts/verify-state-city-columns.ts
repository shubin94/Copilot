import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

async function verify() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'detectives' 
      AND column_name IN ('state', 'city', 'country', 'location')
      ORDER BY column_name;
    `);
    
    console.log('\n✅ VERIFICATION: Detectives table location columns:\n');
    console.log('Column Name       | Data Type | Nullable');
    console.log('------------------|-----------|----------');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(17)} | ${row.data_type.padEnd(9)} | ${row.is_nullable}`);
    });
    
    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'detectives' 
      AND indexname LIKE '%state%' OR indexname LIKE '%city%';
    `);
    
    console.log('\n✅ Indexes created:');
    indexes.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });
    
    // Count detectives
    const count = await pool.query('SELECT COUNT(*) FROM detectives');
    console.log(`\nTotal detectives in table: ${count.rows[0].count}`);
    
  } finally {
    await pool.end();
  }
}

verify().catch(console.error);
