import "../server/lib/loadEnv";
import { pool } from "../db/index.ts";

async function main() {
  const r = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN ('categories', 'tags', 'pages') 
     ORDER BY table_name`
  );
  const names = r.rows.map((x: { table_name: string }) => x.table_name);
  console.log("CMS tables in DB:", names.length ? names.join(", ") : "NONE");
  if (names.length < 3) {
    console.log("Fix: Apply Supabase CMS migrations so categories, tags, pages exist.");
  }
  await pool.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
