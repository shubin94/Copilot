import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function checkSchema() {
  try {
    console.log("\n📋 TAGS TABLE SCHEMA:\n");
    
    // Get all constraints
    const constraintsResult = await pool.query(`
      SELECT 
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'tags'
      ORDER BY con.contype;
    `);
    
    console.log("🔒 Constraints:");
    for (const row of constraintsResult.rows) {
      const type = {
        'p': 'PRIMARY KEY',
        'f': 'FOREIGN KEY',
        'u': 'UNIQUE',
        'c': 'CHECK'
      }[row.constraint_type] || row.constraint_type;
      console.log(`  ${type}: ${row.constraint_name}`);
      console.log(`    ${row.definition}\n`);
    }
    
    // Get all triggers
    const triggersResult = await pool.query(`
      SELECT 
        tgname AS trigger_name,
        pg_get_triggerdef(oid) AS definition
      FROM pg_trigger
      WHERE tgrelid = 'tags'::regclass
      AND tgisinternal = false;
    `);
    
    console.log("⚡ Triggers:");
    for (const row of triggersResult.rows) {
      console.log(`  ${row.trigger_name}`);
      console.log(`    ${row.definition}\n`);
    }
    
    // Check if there are any tags with the same slug
    const duplicateSlugResult = await pool.query(`
      SELECT slug, COUNT(*) as count
      FROM tags
      GROUP BY slug
      HAVING COUNT(*) > 1;
    `);
    
    console.log("🔍 Duplicate slugs:");
    if (duplicateSlugResult.rows.length === 0) {
      console.log("  None found\n");
    } else {
      for (const row of duplicateSlugResult.rows) {
        console.log(`  ${row.slug}: ${row.count} occurrences`);
      }
    }
    
    // Get all tags
    const tagsResult = await pool.query(`SELECT id, name, slug, parent_id, status FROM tags ORDER BY created_at DESC;`);
    console.log(`\n📋 All tags (${tagsResult.rows.length}):`);
    for (const tag of tagsResult.rows) {
      console.log(`  ${tag.name}`);
      console.log(`    slug: ${tag.slug}`);
      console.log(`    id: ${tag.id}`);
      console.log(`    parent_id: ${tag.parent_id || 'null'}`);
      console.log(`    status: ${tag.status}\n`);
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
