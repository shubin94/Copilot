import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

/**
 * Migration script to fix page slugs that incorrectly include category slug prefix.
 * 
 * This fixes pages created before the bug fix, where page.slug was set to 
 * "${category.slug}/${page_title_slug}" instead of just "${page_title_slug}".
 * 
 * For example, a page in category "new-cat/sub-cat" might have slug="new-cat/sub-cat/page-name"
 * when it should only be "page-name".
 */

async function fixPageSlugs() {
  try {
    console.log("🔍 Scanning for pages with malformed slugs...\n");

    // Find all pages with categories
    const result = await pool.query(`
      SELECT 
        p.id,
        p.title,
        p.slug,
        c.id as category_id,
        c.slug as category_slug
      FROM pages p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id IS NOT NULL
      ORDER BY p.created_at
    `);

    const pages = result.rows;
    let fixedCount = 0;
    const changes: Array<{ id: string; oldSlug: string; newSlug: string; title: string }> = [];

    for (const page of pages) {
      if (!page.category_slug) continue;

      // Check if page slug starts with category slug
      if (page.slug.startsWith(page.category_slug + "/")) {
        // Extract the actual page slug by removing the category prefix
        const newSlug = page.slug.substring(page.category_slug.length + 1);

        changes.push({
          id: page.id,
          oldSlug: page.slug,
          newSlug: newSlug,
          title: page.title,
        });

        console.log(`Found malformed slug:`);
        console.log(`  Title: ${page.title}`);
        console.log(`  Category: ${page.category_slug}`);
        console.log(`  Old slug: ${page.slug}`);
        console.log(`  New slug: ${newSlug}\n`);

        fixedCount++;
      }
    }

    if (fixedCount === 0) {
      console.log("✅ No malformed page slugs found. Everything is good!\n");
      return;
    }

    console.log(`\n⚠️  Found ${fixedCount} pages with malformed slugs.\n`);
    console.log("Applying fixes...\n");

    // Apply fixes
    let successCount = 0;
    for (const change of changes) {
      try {
        await pool.query(
          "UPDATE pages SET slug = $1, updated_at = NOW() WHERE id = $2",
          [change.newSlug, change.id]
        );
        console.log(`✅ Fixed: "${change.title}" (${change.oldSlug} → ${change.newSlug})`);
        successCount++;
      } catch (error) {
        console.error(
          `❌ Failed to fix "${change.title}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    console.log(`\n✅ Migration complete! Fixed ${successCount}/${fixedCount} pages.\n`);

    if (successCount === fixedCount) {
      console.log("All page slugs have been corrected successfully!");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixPageSlugs();
