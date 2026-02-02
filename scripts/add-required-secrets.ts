/**
 * Add required app_secrets for production deployment
 * Run this script and then update the placeholder values via Admin panel
 */
import { db } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function addRequiredSecrets() {
  try {
    console.log("🔐 Adding required app_secrets...\n");

    const secretsToAdd = [
      {
        key: "csrf_allowed_origins",
        value: "http://localhost:5000,http://localhost:5173",
        description: "Production: Change to your domain (e.g., https://yourdomain.com)",
      },
      {
        key: "base_url",
        value: "http://localhost:5000",
        description: "Production: Change to your domain (e.g., https://yourdomain.com)",
      },
      {
        key: "supabase_service_role_key",
        value: "PLACEHOLDER_REPLACE_WITH_YOUR_SUPABASE_SERVICE_ROLE_KEY",
        description: "Get from Supabase Dashboard > Settings > API > service_role key",
      },
    ];

    for (const secret of secretsToAdd) {
      // Check if already exists
      const existing = await db
        .select()
        .from(appSecrets)
        .where(eq(appSecrets.key, secret.key))
        .limit(1);

      if (existing.length > 0) {
        console.log(`✅ ${secret.key} already exists (value: ${existing[0].value?.substring(0, 20)}...)`);
      } else {
        await db.insert(appSecrets).values({
          key: secret.key,
          value: secret.value,
        });
        console.log(`✨ Added ${secret.key}`);
        console.log(`   ${secret.description}\n`);
      }
    }

    console.log("\n✅ Required secrets check complete!");
    console.log("\n📝 Next steps:");
    console.log("1. Update placeholder values via Admin panel or database");
    console.log("2. Set NODE_ENV=production in your deployment environment");
    console.log("3. Run: npm run start");

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to add secrets:", error);
    process.exit(1);
  }
}

addRequiredSecrets();
