import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: "postgresql://postgres.gjgrwxxtkyggwfrydpdb:AKshubin123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function createIndex() {
  try {
    console.log("Creating composite index on services table...\n");
    
    const result = await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_lateral_lookup 
      ON services (detective_id, is_active, order_count DESC, updated_at DESC)
      WHERE images IS NOT NULL AND images <> '{}'::text[];
    `);
    
    console.log("✅ Index created successfully");
    
    // Verify index was created
    const indexInfo = await pool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'services' 
        AND indexname = 'idx_services_lateral_lookup';
    `);
    
    if (indexInfo.rows.length > 0) {
      console.log("\n📋 Index Details:");
      console.log(`  Name: ${indexInfo.rows[0].indexname}`);
      console.log(`  Definition: ${indexInfo.rows[0].indexdef}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
  }
}

createIndex();
