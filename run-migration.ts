import { sql, eq } from "drizzle-orm";
import { db } from "./db/index.ts";
import { detectives, subscriptionPlans } from "./shared/schema.ts";

async function runMigration() {
  console.log("🔄 Starting migration: Remove legacy subscription_plan column...\n");

  try {
    // Wrap entire migration in transaction for atomicity
    await db.execute(sql`BEGIN`);

    // Step 1: Get the free plan ID
    const freePlanList = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.monthlyPrice, "0"));

    if (!freePlanList || freePlanList.length === 0) {
      throw new Error("❌ Free plan not found in subscription_plans table!");
    }

    const freePlanId = freePlanList[0].id;
    console.log(`✅ Found free plan: ${freePlanId}\n`);

    // Step 2: Check for NULL subscription_package_id before assignment
    const nullCountResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM detectives WHERE subscription_package_id IS NULL`
    );

    const nullCountRows = (nullCountResult as any).rows ?? (nullCountResult as any) ?? [];
    const nullCount = Number(nullCountRows[0]?.count ?? 0);

    if (nullCount > 0) {
      console.log(`⚠️  Found ${nullCount} detectives with NULL subscription_package_id`);
      console.log(`   Assigning free plan to these detectives...\n`);

      await db.execute(
        sql`UPDATE detectives SET subscription_package_id = ${freePlanId} WHERE subscription_package_id IS NULL`
      );
      console.log(`✅ Assigned free plan to ${nullCount} detectives\n`);
    } else {
      console.log("✅ No detectives with NULL subscription_package_id found\n");
    }

    // Step 3: Verify no remaining stale mappings before dropping column
    console.log("🔄 Verifying no stale subscription_plan mappings...");
    const staleCheck = await db.execute(
      sql`SELECT COUNT(*) as count FROM detectives WHERE subscription_plan IS NOT NULL AND subscription_package_id IS NULL`
    );
    const staleRows = (staleCheck as any).rows ?? (staleCheck as any) ?? [];
    const staleCount = Number(staleRows[0]?.count ?? 0);
    if (staleCount > 0) {
      throw new Error(`Cannot drop subscription_plan: ${staleCount} detectives have NULL subscription_package_id with non-NULL subscription_plan`);
    }
    console.log("✅ No stale mappings found\n");

    // Step 4: Drop the legacy subscription_plan column
    console.log("🔄 Dropping legacy subscription_plan column...");
    await db.execute(sql.raw("ALTER TABLE detectives DROP COLUMN subscription_plan"));
    console.log("✅ Column dropped successfully\n");

    // Step 5: Make subscription_package_id NOT NULL
    console.log("🔄 Making subscription_package_id NOT NULL...");
    await db.execute(sql.raw("ALTER TABLE detectives ALTER COLUMN subscription_package_id SET NOT NULL"));
    console.log("✅ Column constraint updated\n");

    // Step 6: Add foreign key constraint
    console.log("🔄 Adding foreign key constraint...");
    try {
      await db.execute(sql.raw(`
        ALTER TABLE detectives
        ADD CONSTRAINT fk_detectives_subscription_package
        FOREIGN KEY (subscription_package_id) REFERENCES subscription_plans(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
      `));
      console.log("✅ Foreign key constraint added\n");
    } catch (e) {
      if ((e as any).message?.includes("already exists")) {
        console.log("✅ Foreign key constraint already exists\n");
      } else {
        throw e;
      }
    }

    // Final verification
    console.log("🔄 Verifying migration...");
    const remaining = await db.execute(
      sql`SELECT COUNT(*) as count FROM detectives WHERE subscription_package_id IS NULL`
    );

    const remainingRows = (remaining as any).rows ?? (remaining as any) ?? [];
    const remainingCount = Number(remainingRows[0]?.count ?? 0);
    if (remainingCount > 0) {
      throw new Error(`❌ ERROR: ${remainingCount} detectives still have NULL subscription_package_id!`);
    }

    console.log("✅ Verification passed: All detectives have valid subscription_package_id\n");

    // Check schema
    const columnsResult = await db.execute(
      sql.raw(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'detectives' AND column_name = 'subscription_plan'"
      )
    );

    const columns = (columnsResult as any).rows ?? (columnsResult as any) ?? [];
    if (columns && columns.length > 0) {
      throw new Error("❌ ERROR: subscription_plan column still exists!");
    }

    console.log("✅ Confirmed: subscription_plan column no longer exists\n");

    console.log("=".repeat(60));
    console.log("🎉 MIGRATION COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n📋 Changes applied:");
    console.log("   1. Assigned free plan to detectives with NULL subscription_package_id");
    console.log("   2. Dropped legacy subscription_plan column");
    console.log("   3. Made subscription_package_id NOT NULL");
    console.log("   4. Added foreign key constraint");
    console.log("\n✨ Database now has single source of truth: subscription_package_id\n");

    // Commit transaction
    await db.execute(sql`COMMIT`);

    process.exit(0);
  } catch (error) {
    // Rollback on error
    try {
      await db.execute(sql`ROLLBACK`);
    } catch (rollbackError) {
      console.error("❌ Error rolling back transaction:", rollbackError);
    }
    console.error("\n❌ MIGRATION FAILED:");
    console.error(error);
    process.exit(1);
  }
}

runMigration();
