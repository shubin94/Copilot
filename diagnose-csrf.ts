import "dotenv/config";
import { db } from "./db/index.ts";
import { appSecrets } from "./shared/schema.ts";

async function diagnose() {
  try {
    console.log("🔍 CSRF Token Error Diagnostic\n");

    // 1. Check if session_secret exists and is valid
    console.log("1️⃣  Checking session_secret in database...");
    const secret = await db.select().from(appSecrets)
      .where((t) => t.key === "session_secret")
      .limit(1);
    
    if (secret.length === 0) {
      console.log("   ❌ session_secret NOT found in app_secrets");
    } else if (!secret[0].value || secret[0].value.trim() === "") {
      console.log("   ❌ session_secret is EMPTY");
    } else {
      console.log(`   ✅ session_secret found: ${secret[0].value.substring(0, 10)}...`);
    }

    // 2. Check CSRF_ALLOWED_ORIGINS
    console.log("\n2️⃣  Checking CSRF_ALLOWED_ORIGINS...");
    const cors = await db.select().from(appSecrets)
      .where((t) => t.key === "csrf_allowed_origins")
      .limit(1);
    
    if (cors.length === 0) {
      console.log("   ❌ csrf_allowed_origins NOT found");
    } else {
      console.log(`   ✅ csrf_allowed_origins: ${cors[0].value}`);
      const origins = cors[0].value?.split(",") || [];
      console.log(`   - Contains ${origins.length} origins`);
      origins.forEach((o, i) => console.log(`     ${i+1}. ${o.trim()}`));
    }

    // 3. Check all required secrets
    console.log("\n3️⃣  Checking all required secrets...");
    const required = [
      "session_secret",
      "base_url",
      "csrf_allowed_origins",
      "host",
      "supabase_service_role_key",
    ];
    
    const allSecrets = await db.select().from(appSecrets);
    const secretMap = new Map(allSecrets.map(s => [s.key, s]));
    
    required.forEach(key => {
      const secret = secretMap.get(key);
      if (secret?.value?.trim()) {
        console.log(`   ✅ ${key}`);
      } else {
        console.log(`   ❌ ${key} - MISSING OR EMPTY`);
      }
    });

    // 4. Check email provider
    console.log("\n4️⃣  Checking email provider...");
    const sendpulse = [
      secretMap.has("sendpulse_api_id") && secretMap.get("sendpulse_api_id")?.value?.trim(),
      secretMap.has("sendpulse_api_secret") && secretMap.get("sendpulse_api_secret")?.value?.trim(),
      secretMap.has("sendpulse_sender_email") && secretMap.get("sendpulse_sender_email")?.value?.trim(),
    ];
    
    if (sendpulse.every(x => x)) {
      console.log("   ✅ SendPulse fully configured");
    } else {
      console.log("   ❌ SendPulse incomplete");
    }

    console.log("\n✅ Diagnostic complete");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

diagnose().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
