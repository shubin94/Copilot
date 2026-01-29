import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const res = await pool.query("SELECT COUNT(*)::int AS count FROM detective_snippets");
  console.log("detective_snippets count:", res.rows[0].count);
  const latest = await pool.query("SELECT id, name, country, state, city, category, \"limit\", created_at FROM detective_snippets ORDER BY created_at DESC LIMIT 5");
  console.log("latest snippets:", latest.rows);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
