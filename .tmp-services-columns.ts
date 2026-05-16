import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function run() {
  const rows = await db.execute(sql.raw("SELECT column_name FROM information_schema.columns WHERE table_name='services' ORDER BY ordinal_position"));
  console.log(JSON.stringify(rows.rows, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
