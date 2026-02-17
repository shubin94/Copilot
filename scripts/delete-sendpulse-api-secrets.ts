import "../server/lib/loadEnv";
import { db, pool } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";
import { inArray } from "drizzle-orm";

async function main() {
  const keys = [
    "sendpulse_api_id",
    "sendpulse_api_secret",
    "sendpulse_sender_email",
    "sendpulse_sender_name",
    "sendpulse_enabled",
  ] as const;

  const result = await db
    .delete(appSecrets)
    .where(inArray(appSecrets.key, [...keys]));

  console.log(`Deleted ${result.rowCount ?? 0} SendPulse API secret(s).`);
  await pool.end();
}

main().catch((error) => {
  console.error("Failed to delete SendPulse API secrets:", error);
  process.exit(1);
});
