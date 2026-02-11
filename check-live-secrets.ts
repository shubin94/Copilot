import { db } from "./db/index.ts";
import { appSecrets } from "./shared/schema.ts";

async function checkSecrets() {
  try {
    console.log("🔍 Checking app_secrets table in LIVE database...\n");
    
    const secrets = await db.select().from(appSecrets);
    
    console.log(`Total secrets found: ${secrets.length}\n`);
    
    if (secrets.length === 0) {
      console.log("❌ No secrets found in app_secrets table!");
      return;
    }
    
    console.log("📋 All secrets:");
    secrets.forEach((secret) => {
      const valuePreview = secret.value 
        ? `${secret.value.substring(0, 20)}...` 
        : "(empty)";
      console.log(`  - ${secret.key}: ${valuePreview}`);
    });
    
    console.log("\n🔑 Checking for deepseek_api_key specifically...");
    const deepseekSecret = secrets.find(s => s.key === "deepseek_api_key");
    
    if (!deepseekSecret) {
      console.log("❌ deepseek_api_key NOT FOUND in database!");
      console.log("\n💡 Solution: Go to Admin → App Secrets and add your DeepSeek API key");
    } else if (!deepseekSecret.value || deepseekSecret.value.trim() === "") {
      console.log("⚠️  deepseek_api_key exists but value is EMPTY!");
      console.log("\n💡 Solution: Go to Admin → App Secrets and update the DeepSeek API key value");
    } else {
      console.log("✅ deepseek_api_key found!");
      console.log(`   Value: ${deepseekSecret.value.substring(0, 30)}...`);
      console.log(`   Length: ${deepseekSecret.value.length} characters`);
      console.log("\n✅ API key is properly configured in database!");
      console.log("💡 If Smart Search still doesn't work, restart your production server");
    }
    
  } catch (error) {
    console.error("❌ Error checking secrets:", error);
  }
  
  process.exit(0);
}

checkSecrets();
