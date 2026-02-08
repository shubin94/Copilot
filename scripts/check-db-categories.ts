import pkg from "pg";
import { loadEnv } from "../server/lib/loadEnv.ts";

const { Pool } = pkg;

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

(async () => {
  try {
    console.log("\n📋 Categories in database:\n");
    const result = await pool.query(
      "SELECT id, name, slug, status FROM categories ORDER BY created_at DESC"
    );

    if (result.rows.length === 0) {
      console.log("  No categories found.\n");
    } else {
      result.rows.forEach((cat, idx) => {
        const catId = String(cat.id ?? "");
        console.log(`${idx + 1}. ${cat.name}`);
        console.log(`   slug: ${cat.slug}`);
        console.log(`   status: ${cat.status}`);
        console.log(`   id: ${catId.substring(0, 12)}...`);
        console.log("");
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Error:", String(error));
    }
  } finally {
    await pool.end();
  }
})();
