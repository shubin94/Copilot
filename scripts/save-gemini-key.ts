import "../server/lib/loadEnv.js";
import { db } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

const GEMINI_API_KEY = "AIzaSyDMVbEWEpSY_MAukE2-CfCvae9dIGjip-Q";

async function saveGeminiKey() {
  try {
    console.log("🔐 Saving Gemini API key to database...");
    
    // Check if it already exists
    const existing = await db
      .select()
      .from(appSecrets)
      .where(eq(appSecrets.key, "gemini_api_key"));
    
    if (existing.length > 0) {
      // Update existing
      await db
        .update(appSecrets)
        .set({ value: GEMINI_API_KEY })
        .where(eq(appSecrets.key, "gemini_api_key"));
      console.log("✅ Updated existing Gemini API key");
    } else {
      // Insert new
      await db.insert(appSecrets).values({
        key: "gemini_api_key",
        value: GEMINI_API_KEY,
      });
      console.log("✅ Inserted new Gemini API key");
    }
    
    console.log("🔒 Key is now stored securely in the database");
    console.log("✓ Not stored in .env or version control");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to save Gemini key:", error);
    process.exit(1);
  }
}

saveGeminiKey();
