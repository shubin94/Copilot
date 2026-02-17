import "../server/lib/loadEnv";
import { db, pool } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";
import { inArray } from "drizzle-orm";

const EMAIL_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_pass",
  "smtp_from_email",
  "sendpulse_api_id",
  "sendpulse_api_secret",
  "sendpulse_sender_email",
  "sendpulse_sender_name",
  "sendpulse_enabled",
] as const;

async function main() {
  const rows = await db
    .select({ key: appSecrets.key, value: appSecrets.value })
    .from(appSecrets)
    .where(inArray(appSecrets.key, [...EMAIL_KEYS]));

  const byKey = new Map(rows.map((r) => [r.key, (r.value ?? "").trim()]));

  console.log("\nEmail secrets status (value present?)\n");
  for (const key of EMAIL_KEYS) {
    const value = byKey.get(key) || "";
    const present = value.length > 0 ? "YES" : "NO";
    console.log(`${key}: ${present}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error("Failed to check email secrets:", error);
  process.exit(1);
});
