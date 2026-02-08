import { db } from "./db/index.ts";
import { detectives } from "./shared/schema.ts";
import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";

async function testFix() {
  console.log("✅ Testing subscription_plan removal fix...\n");

  try {
    // Get one detective from ORM
    const detective = await db.query.detectives.findFirst({
      where: (fields, ops) => ops.eq(fields.status, "active"),
    });

    if (!detective) {
      console.log("❌ No active detectives found");
      process.exit(1);
    }

    console.log(`✅ Found detective: ${detective.businessName}`);
    console.log(`   ID: ${detective.id}`);
    console.log(`   Subscription Package ID: ${detective.subscriptionPackageId || "(NOT SET)"}`);

    // Verify subscriptionPlan field no longer exists by checking the object keys
    const keys = Object.keys(detective);
    const hasOldField = keys.includes("subscriptionPlan");
    console.log(`   Has old subscriptionPlan field in ORM: ${hasOldField ? "❌ FAILED - STILL EXISTS" : "✅ REMOVED"}`);

    if (hasOldField) {
      console.log(`   ⚠️  Detective object still has subscriptionPlan field!`);
      console.log(`   Value: ${(detective as any).subscriptionPlan}`);
    }

    // Verify with raw SQL that subscriptionPackageId column exists and has data
    console.log("\n📊 Verifying database schema with raw SQL...");
    const columnCheckResult = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name='detectives' AND column_name IN ('subscription_plan', 'subscription_package_id')`
    );

    const columns = (((columnCheckResult as any).rows || (columnCheckResult as any))).map((row: any) => row.column_name);
    const hasSubscriptionPlan = columns.includes("subscription_plan");
    const hasSubscriptionPackageId = columns.includes("subscription_package_id");

    console.log(`   subscription_plan column in schema: ${hasSubscriptionPlan ? "❌ SHOULD BE REMOVED" : "✅ REMOVED"}`);
    console.log(`   subscription_package_id column in schema: ${hasSubscriptionPackageId ? "✅ EXISTS" : "❌ MISSING"}`);

    // Check that all detectives have non-null subscriptionPackageId
    const nullCheckResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM detectives WHERE subscription_package_id IS NULL`
    );

    const nullCount = ((nullCheckResult as any).rows?.[0] ?? (nullCheckResult as any)[0])?.count ?? 0;
    console.log(`   Detectives with NULL subscription_package_id: ${nullCount === 0 ? "✅ NONE" : `❌ ${nullCount} FOUND`}`);

    console.log("\n" + "=".repeat(60));
    if (!hasSubscriptionPlan && hasSubscriptionPackageId && nullCount === 0) {
      console.log("✅ DATABASE FIX VERIFIED!");
      console.log("=".repeat(60));
      console.log("\n📋 Summary:");
      console.log("   ✅ subscriptionPlan column removed from database");
      console.log("   ✅ subscription_package_id column exists");
      console.log("   ✅ All detectives have a valid subscription package assigned");
      console.log("\n✨ Migration successful - single source of truth established\n");
      process.exit(0);
    } else {
      console.log("❌ DATABASE FIX INCOMPLETE");
      console.log("=".repeat(60));
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

testFix();
