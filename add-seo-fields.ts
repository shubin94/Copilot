import { pool } from "./db/index.ts";

async function addSeoFields() {
  try {
    console.log("Adding SEO fields to pages table...");
    
    await pool.query("ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255)");
    console.log("✅ Added meta_title column");
    
    await pool.query("ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_description TEXT");
    console.log("✅ Added meta_description column");
    
    console.log("✅ SEO fields migration complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addSeoFields();
