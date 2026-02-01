/**
 * Save Deepseek API key to the app_secrets table
 * Usage: npx tsx scripts/save-deepseek-key.ts <API_KEY>
 */

import { db } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

const apiKey = process.argv[2];

if (!apiKey) {
  console.error("❌ No API key provided");
  console.log("Usage: npx tsx scripts/save-deepseek-key.ts <YOUR_DEEPSEEK_API_KEY>");
  process.exit(1);
}

async function saveKey() {
  try {
    // Check if key exists
    const existing = await db
      .select()
      .from(appSecrets)
      .where(eq(appSecrets.key, "deepseek_api_key"));

    if (existing.length > 0) {
      // Update existing
      await db
        .update(appSecrets)
        .set({ value: apiKey })
        .where(eq(appSecrets.key, "deepseek_api_key"));
      console.log("✅ Updated Deepseek API key");
    } else {
      // Insert new
      await db.insert(appSecrets).values({
        key: "deepseek_api_key",
        value: apiKey,
      });
      console.log("✅ Inserted new Deepseek API key");
    }

    console.log("🔒 Key is now stored securely in the database");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to save Deepseek API key:", error);
    process.exit(1);
  }
}

saveKey();
