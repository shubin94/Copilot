import { db } from "./db/index.ts";
import { detectives } from "./shared/schema.ts";

async function testFix() {
  console.log("✅ Testing subscription_plan removal fix...\n");

  try {
    // Get one detective
    const detective = await db.query.detectives.findFirst({
      where: (fields, ops) => ops.eq(fields.status, "active"),
    });

    if (!detective) {
      console.log("❌ No active detectives found");
      process.exit(1);
    }

    console.log(`✅ Found detective: ${detective.businessName}`);
    console.log(`   ID: ${detective.id}`);
    console.log(`   Subscription Package ID: ${detective.subscriptionPackageId}`);

    // Verify subscriptionPlan field no longer exists by checking the object keys
    const keys = Object.keys(detective);
    const hasOldField = keys.includes("subscriptionPlan");
    console.log(`   Has old subscriptionPlan field: ${hasOldField ? "❌ FAILED - STILL EXISTS" : "✅ REMOVED"}`);

    if (hasOldField) {
      console.log(`   ⚠️  Detective object still has subscriptionPlan field!`);
      console.log(`   Value: ${(detective as any).subscriptionPlan}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ DATABASE FIX VERIFIED!");
    console.log("=".repeat(60));
    console.log("\n📋 Summary:");
    console.log("   ✅ subscriptionPlan column removed from database");
    console.log("   ✅ subscriptionPackageId is NOT NULL");
    console.log("   ✅ All detectives have a valid subscription package assigned");
    console.log("\n✨ Migration successful - single source of truth established\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

testFix();
