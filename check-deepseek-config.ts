import { db } from "./db/index.ts";
import { appSecrets } from "./shared/schema.ts";
import { config } from "./server/config.ts";
import { loadSecretsFromDatabase } from "./server/lib/secretsLoader.ts";

async function checkDeepseekConfig() {
  console.log("🔍 DEEPSEEK API KEY DIAGNOSTIC\n");
  console.log("=" .repeat(60));
  
  // Step 1: Check database
  console.log("\n📊 STEP 1: Checking database...");
  try {
    const secrets = await db.select().from(appSecrets);
    const deepseekSecret = secrets.find(s => s.key === "deepseek_api_key");
    
    if (!deepseekSecret) {
      console.log("❌ deepseek_api_key NOT FOUND in database!");
      process.exit(1);
    }
    
    if (!deepseekSecret.value || deepseekSecret.value.trim() === "") {
      console.log("❌ deepseek_api_key exists but value is EMPTY!");
      process.exit(1);
    }
    
    console.log("✅ Database check passed");
    console.log(`   Key: deepseek_api_key`);
    console.log(`   Value: ${deepseekSecret.value.substring(0, 20)}...`);
    console.log(`   Length: ${deepseekSecret.value.length} characters`);
    
    // Step 2: Check config object BEFORE loading secrets
    console.log("\n⚙️  STEP 2: Checking config object BEFORE loading secrets...");
    console.log(`   config.deepseek exists: ${!!config.deepseek}`);
    console.log(`   config.deepseek.apiKey: ${config.deepseek?.apiKey || '(not set)'}`);
    
    // Step 3: Load secrets from database
    console.log("\n📥 STEP 3: Loading secrets from database...");
    await loadSecretsFromDatabase();
    console.log("✅ Secrets loaded");
    
    // Step 4: Check config object AFTER loading secrets
    console.log("\n⚙️  STEP 4: Checking config object AFTER loading secrets...");
    console.log(`   config.deepseek exists: ${!!config.deepseek}`);
    
    if (config.deepseek?.apiKey) {
      console.log(`   config.deepseek.apiKey: ${config.deepseek.apiKey.substring(0, 20)}...`);
      console.log(`   Length: ${config.deepseek.apiKey.length} characters`);
      
      // Verify it matches database value
      if (config.deepseek.apiKey === deepseekSecret.value) {
        console.log("✅ Config matches database value!");
      } else {
        console.log("⚠️  Config does NOT match database value!");
        console.log(`   DB:     ${deepseekSecret.value.substring(0, 30)}...`);
        console.log(`   Config: ${config.deepseek.apiKey.substring(0, 30)}...`);
      }
    } else {
      console.log("❌ config.deepseek.apiKey is NOT SET!");
    }
    
    // Step 5: Test API connection
    console.log("\n🌐 STEP 5: Testing DeepSeek API connection...");
    
    if (!config.deepseek?.apiKey) {
      console.log("⏭️  Skipping API test (no API key in config)");
    } else {
      try {
        const testResponse = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.deepseek.apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "user",
                content: "Say 'API works' if you can read this."
              }
            ],
            max_tokens: 10,
            temperature: 0,
          }),
        });
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          console.log(`❌ API request failed: ${testResponse.status} ${testResponse.statusText}`);
          console.log(`   Response: ${errorText.substring(0, 200)}`);
        } else {
          const result = await testResponse.json();
          console.log("✅ API connection successful!");
          console.log(`   Model: ${result.model || 'N/A'}`);
          console.log(`   Response: ${result.choices?.[0]?.message?.content || 'N/A'}`);
        }
      } catch (error) {
        console.log(`❌ API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 SUMMARY");
    console.log("=".repeat(60));
    
    const checks = [
      { name: "Database has key", status: !!deepseekSecret?.value },
      { name: "Config loaded key", status: !!config.deepseek?.apiKey },
      { name: "Values match", status: config.deepseek?.apiKey === deepseekSecret?.value },
    ];
    
    checks.forEach(check => {
      console.log(`${check.status ? "✅" : "❌"} ${check.name}`);
    });
    
    const allPassed = checks.every(c => c.status);
    
    if (allPassed) {
      console.log("\n🎉 All checks passed! DeepSeek API key is properly configured.");
      console.log("💡 If Smart Search still doesn't work in production:");
      console.log("   1. Make sure you restarted the production server");
      console.log("   2. Check production server logs for any errors");
      console.log("   3. Verify the API key has sufficient credits/quota");
    } else {
      console.log("\n⚠️  Some checks failed. Review the issues above.");
    }
    
  } catch (error) {
    console.error("\n❌ Error during diagnostic:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkDeepseekConfig();
