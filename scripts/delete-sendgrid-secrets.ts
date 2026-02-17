import "../server/lib/loadEnv";
import { db, pool } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";
import { inArray } from "drizzle-orm";

async function main() {
  const keys = ["sendgrid_api_key", "sendgrid_from_email"] as const;
  const result = await db
    .delete(appSecrets)
    .where(inArray(appSecrets.key, [...keys]));

  console.log(`Deleted ${result.rowCount ?? 0} SendGrid secret(s).`);
  await pool.end();
}

main().catch((error) => {
  console.error("Failed to delete SendGrid secrets:", error);
  process.exit(1);
});
