import { db } from "./db/index.ts";
import { detectives, subscriptionPlans } from "./shared/schema.ts";
import { sql } from "drizzle-orm";

async function fixNullPackages() {
  console.log("🔄 Fixing detectives with NULL subscription_package_id...\n");

  try {
    // Get the free plan
    const freePlanResult = await db.execute(
      sql`SELECT id FROM subscription_plans
          WHERE (CAST(monthly_price AS numeric) = 0 OR name = 'free' OR display_name ILIKE 'free')
            AND is_active = true
          ORDER BY monthly_price ASC
          LIMIT 1`
    );

    const freePlanRows = (freePlanResult as any).rows ?? (freePlanResult as any);
    const freePlanId = freePlanRows?.[0]?.id ?? (freePlanResult as any).id;
    if (!freePlanId) {
      throw new Error("Free plan not found!");
    }

    console.log(`✅ Found free plan: ${freePlanId}\n`);

    // Find detectives with NULL subscription_package_id
    const nullDetectivesResult = await db.execute(
      sql`SELECT id, business_name FROM detectives WHERE subscription_package_id IS NULL`
    );

    const nullDetectives = (nullDetectivesResult as any).rows ?? (nullDetectivesResult as any) ?? [];
    console.log(`Found ${nullDetectives.length} detectives with NULL subscription_package_id:`);
    for (const det of nullDetectives) {
      console.log(`  - ${det.business_name} (${det.id})`);
    }
    console.log("");

    // Assign free plan to all of them
    if (nullDetectives.length > 0) {
      await db.execute(
        sql`UPDATE detectives SET subscription_package_id = ${freePlanId} WHERE subscription_package_id IS NULL`
      );
      console.log(`✅ Assigned free plan to ${nullDetectives.length} detectives\n`);
    }

    // Now try to make subscription_package_id NOT NULL
    console.log("🔄 Making subscription_package_id NOT NULL...");
    await db.execute(sql.raw("ALTER TABLE detectives ALTER COLUMN subscription_package_id SET NOT NULL"));
    console.log("✅ Column constraint applied\n");

    // Verify
    const remainingResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM detectives WHERE subscription_package_id IS NULL`
    );

    const remaining = (remainingResult as any)[0]?.count ?? 0;
    if (remaining > 0) {
      throw new Error(`Still have ${remaining} NULL subscription_package_id rows!`);
    }

    console.log("=".repeat(60));
    console.log("🎉 ALL FIXED!");
    console.log("=".repeat(60));
    process.exit(0);
  } catch (error) {
    console.error("❌ FAILED:", error);
    process.exit(1);
  }
}

fixNullPackages();
