import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`ALTER TABLE detectives ADD COLUMN IF NOT EXISTS phone_country_code TEXT`);
  await db.execute(sql`ALTER TABLE detectives ADD COLUMN IF NOT EXISTS phone_number TEXT`);
  console.log("phone columns ensured");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("failed to ensure phone columns", error);
    process.exit(1);
  });
