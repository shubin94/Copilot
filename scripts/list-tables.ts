import pkg from "pg";
const { Pool } = pkg;

async function main() {
  const url = process.env.DATABASE_URL!;
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  for (const row of res.rows) {
    console.log(row.table_name);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

