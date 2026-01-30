import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function checkTables() {
  try {
    console.log("\n📋 CHECKING CMS DATABASE TABLES...\n");
    
    // List all tables
    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log("✅ ALL TABLES IN DATABASE:");
    const tableNames = allTables.rows.map(r => r.table_name);
    tableNames.forEach(name => console.log(`   - ${name}`));
    
    // Check for CMS tables specifically
    console.log("\n🔍 CMS-RELATED TABLES CHECK:");
    const cmsTableNames = ['categories', 'tags', 'pages', 'page_tags'];
    
    for (const tableName of cmsTableNames) {
      const exists = tableNames.includes(tableName);
      console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
      
      if (exists) {
        // Show columns for existing table
        const columns = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        console.log(`      Columns:`);
        columns.rows.forEach(col => {
          console.log(`        - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });
      }
    }
    
    // Check for serviceCategories (for comparison)
    console.log("\n📊 COMPARISON TABLE:");
    const hasSrvCat = tableNames.includes('service_categories');
    console.log(`   ${hasSrvCat ? '✅' : '❌'} service_categories`);
    
  } catch (error) {
    console.error("❌ Database query failed:", error);
  } finally {
    await pool.end();
  }
}

checkTables();
