import { pool } from "./db/index.ts";

async function test() {
  try {
    console.log("🔍 Checking published pages...");
    const result = await pool.query(
      "SELECT id, title, slug, status FROM pages WHERE status = 'published' LIMIT 5"
    );
    console.log("Published pages:", result.rows);

    console.log("\n🔍 Checking page with slug 'sdfds'...");
    const pageResult = await pool.query(
      "SELECT * FROM pages WHERE slug = 'sdfds' LIMIT 1"
    );
    console.log("Page result:", pageResult.rows[0]);

    if (pageResult.rows[0]) {
      const pageId = pageResult.rows[0].id;
      console.log("\n🔍 Checking tags for page...");
      const tagsResult = await pool.query(
        "SELECT t.* FROM tags t JOIN page_tags pt ON t.id = pt.tag_id WHERE pt.page_id = $1",
        [pageId]
      );
      console.log("Tags:", tagsResult.rows);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

test();
