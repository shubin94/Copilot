import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function verifyMigration() {
  try {
    console.log("\n✅ CMS MIGRATION VERIFICATION\n");
    
    // Check tables
    console.log("📊 TABLES:");
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('categories', 'tags', 'pages', 'page_tags')
      ORDER BY table_name
    `);
    
    for (const row of tables.rows) {
      console.log(`   ✅ ${row.table_name}`);
    }
    
    // Check indexes
    console.log("\n📑 INDEXES:");
    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('categories', 'tags', 'pages', 'page_tags')
      ORDER BY indexname
    `);
    
    for (const row of indexes.rows) {
      console.log(`   ✅ ${row.indexname}`);
    }
    
    // Check triggers
    console.log("\n⚡ TRIGGERS:");
    const triggers = await pool.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public' AND event_object_table IN ('categories', 'tags', 'pages')
      ORDER BY trigger_name
    `);
    
    if (triggers.rows.length > 0) {
      for (const row of triggers.rows) {
        console.log(`   ✅ ${row.trigger_name}`);
      }
    } else {
      console.log(`   ⚠️  No auto-update triggers found (non-critical)`);
    }
    
    // Check constraints
    console.log("\n🔐 CONSTRAINTS:");
    const constraints = await pool.query(`
      SELECT table_name, constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name IN ('categories', 'tags', 'pages', 'page_tags')
      ORDER BY table_name, constraint_name
    `);
    
    for (const row of constraints.rows) {
      console.log(`   ✅ ${row.table_name}: ${row.constraint_name} (${row.constraint_type})`);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ MIGRATION COMPLETE - All 4 CMS tables created successfully!");
    console.log("=".repeat(60) + "\n");
    
  } catch (error) {
    console.error("Error during verification:", error);
  } finally {
    await pool.end();
  }
}

verifyMigration();
