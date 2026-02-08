import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not set. Set it before running this script.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function checkTags() {
  try {
    console.log("\n📋 All tags in database:\n");
    
    const result = await pool.query(`
      SELECT id, name, slug, parent_id, status, created_at
      FROM tags
      ORDER BY created_at DESC;
    `);
    
    console.log(`Found ${result.rows.length} tags:\n`);
    
    for (const tag of result.rows) {
      console.log(`${tag.name}`);
      console.log(`  slug: ${tag.slug}`);
      console.log(`  id: ${tag.id}`);
      console.log(`  parent_id: ${tag.parent_id || 'null'}`);
      console.log(`  status: ${tag.status}`);
      console.log(`  created: ${tag.created_at}\n`);
    }
    
    // Check for duplicate slugs (scoped by parent_id for hierarchical structure)
    const dupResult = await pool.query(`
      SELECT parent_id, slug, COUNT(*) as count, array_agg(id) as ids
      FROM tags
      GROUP BY parent_id, slug
      HAVING COUNT(*) > 1;
    `);
    
    if (dupResult.rows.length > 0) {
      console.log("\n⚠️  DUPLICATE SLUGS FOUND (same slug under same parent):\n");
      for (const dup of dupResult.rows) {
        console.log(`Parent ID "${dup.parent_id || 'root'}" - Slug "${dup.slug}" appears ${dup.count} times`);
        console.log(`  IDs: ${dup.ids.join(', ')}\n`);
      }
    } else {
      console.log("✅ No duplicate slugs within same parent\n");
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkTags();
