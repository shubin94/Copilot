import { db } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function checkApiKey() {
  try {
    const rows = await db.select().from(appSecrets).where(eq(appSecrets.key, "deepseek_api_key"));
    
    if (rows.length === 0) {
      console.log("❌ No deepseek_api_key found in database");
      process.exit(1);
    }
    
    const key = rows[0].value;
    console.log("Key length:", key.length);
    console.log("\nChecking for invalid characters...");
    
    for (let i = 0; i < key.length; i++) {
      const char = key[i];
      const code = char.charCodeAt(0);
      if (code > 127) {
        console.log(`❌ Invalid character at position ${i}: charCode ${code} (${char})`);
      }
    }
    
    // Check for zero-width space (8203)
    if (key.includes('\u200B')) {
      console.log("❌ Found zero-width space (U+200B) in API key!");
    }
    
    console.log("\nCleaned key (visible characters):");
    const cleaned = key.replace(/[\u200B-\u200D\uFEFF]/g, '');
    console.log(cleaned);
    console.log("\nCleaned length:", cleaned.length);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkApiKey();
