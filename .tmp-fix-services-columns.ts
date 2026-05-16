import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql.raw("ALTER TABLE services ADD COLUMN IF NOT EXISTS review_avg numeric(4,2) NOT NULL DEFAULT 0"));
  await db.execute(sql.raw("ALTER TABLE services ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0"));
  console.log("SERVICES_COLUMNS_FIXED");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
