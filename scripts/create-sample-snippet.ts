import "../server/lib/loadEnv";
import pkg from "pg";
const { Pool } = pkg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const detective = await client.query(
      "SELECT id, country, state, city FROM detectives ORDER BY created_at DESC LIMIT 1"
    );
    const category = await client.query(
      "SELECT name FROM service_categories WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
    );

    if (detective.rows.length === 0) {
      throw new Error("No detectives found. Create at least one detective first.");
    }
    if (category.rows.length === 0) {
      throw new Error("No active service categories found. Create at least one category.");
    }

    const d = detective.rows[0];
    const c = category.rows[0];

    const name = `Sample Snippet - ${c.name} - ${d.city || "City"}`;

    const insert = await client.query(
      `INSERT INTO detective_snippets (name, country, state, city, category, "limit")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, country, state, city, category, "limit"`,
      [name, d.country, d.state, d.city, c.name, 4]
    );

    const snippet = insert.rows[0];
    console.log("✅ Sample snippet created:");
    console.log(snippet);
    console.log(`\nUse this code:\n<DetectiveSnippetGrid snippetId=\"${snippet.id}\" />`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Failed to create sample snippet:", e.message || e);
  process.exit(1);
});
