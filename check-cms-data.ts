import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function checkCMSData() {
  const client = await pool.connect();
  try {
    console.log("\n📋 CHECKING CMS DATABASE DATA\n");
    
    // Check categories
    const categoriesResult = await client.query(`
      SELECT id, name, slug, parent_id, status, created_at
      FROM categories
      ORDER BY created_at DESC;
    `);
    
    console.log(`\n📁 CATEGORIES (${categoriesResult.rows.length} total):`);
    if (categoriesResult.rows.length === 0) {
      console.log("  ✅ No categories in database\n");
    } else {
      for (const cat of categoriesResult.rows) {
        console.log(`\n  ${cat.name}`);
        console.log(`    slug: ${cat.slug}`);
        console.log(`    id: ${cat.id}`);
        console.log(`    parent_id: ${cat.parent_id || 'null'}`);
        console.log(`    status: ${cat.status}`);
        console.log(`    created: ${cat.created_at}`);
      }
    }
    
    // Check tags
    const tagsResult = await client.query(`
      SELECT id, name, slug, parent_id, status, created_at
      FROM tags
      ORDER BY created_at DESC;
    `);
    
    console.log(`\n🏷️  TAGS (${tagsResult.rows.length} total):`);
    if (tagsResult.rows.length === 0) {
      console.log("  ✅ No tags in database\n");
    } else {
      for (const tag of tagsResult.rows) {
        console.log(`\n  ${tag.name}`);
        console.log(`    slug: ${tag.slug}`);
        console.log(`    id: ${tag.id}`);
        console.log(`    parent_id: ${tag.parent_id || 'null'}`);
        console.log(`    status: ${tag.status}`);
        console.log(`    created: ${tag.created_at}`);
      }
    }
    
    // Check pages
    const pagesResult = await client.query(`
      SELECT id, title, slug, category_id, status, created_at
      FROM pages
      ORDER BY created_at DESC;
    `);
    
    console.log(`\n📄 PAGES (${pagesResult.rows.length} total):`);
    if (pagesResult.rows.length === 0) {
      console.log("  ✅ No pages in database\n");
    } else {
      for (const page of pagesResult.rows) {
        console.log(`\n  ${page.title}`);
        console.log(`    slug: ${page.slug}`);
        console.log(`    id: ${page.id}`);
        console.log(`    category_id: ${page.category_id}`);
        console.log(`    status: ${page.status}`);
        console.log(`    created: ${page.created_at}`);
      }
    }
    
    // Check for duplicate slugs
    const dupCatResult = await client.query(`
      SELECT slug, COUNT(*) as count, array_agg(id) as ids
      FROM categories
      GROUP BY slug
      HAVING COUNT(*) > 1;
    `);
    
    const dupTagResult = await client.query(`
      SELECT slug, COUNT(*) as count, array_agg(id) as ids
      FROM tags
      GROUP BY slug
      HAVING COUNT(*) > 1;
    `);
    
    if (dupCatResult.rows.length > 0 || dupTagResult.rows.length > 0) {
      console.log("\n⚠️  DUPLICATE SLUGS FOUND:\n");
      
      if (dupCatResult.rows.length > 0) {
        console.log("  Categories:");
        for (const dup of dupCatResult.rows) {
          console.log(`    "${dup.slug}" appears ${dup.count} times (${dup.ids.join(', ')})`);
        }
      }
      
      if (dupTagResult.rows.length > 0) {
        console.log("  Tags:");
        for (const dup of dupTagResult.rows) {
          console.log(`    "${dup.slug}" appears ${dup.count} times (${dup.ids.join(', ')})`);
        }
      }
    } else {
      console.log("\n✅ No duplicate slugs found\n");
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await client.release();
    await pool.end();
  }
}

checkCMSData();
