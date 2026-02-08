/**
 * Verify CMS table constraints are working correctly
 */

import "../server/lib/loadEnv";
import { db } from "../db/index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("\n✅ Verifying CMS table constraints...\n");

  let allPassed = true;

  try {
    // Test 1: Try to insert invalid status (should fail)
    console.log("Test 1: Attempting to insert invalid status (should fail)...");
    try {
      await db.execute(sql`
        INSERT INTO categories (name, slug, status) 
        VALUES ('Test', 'test-category', 'invalid_status')
      `);
      console.log("❌ ERROR: Invalid status was accepted! Constraint is missing.");
      allPassed = false;
    } catch (error) {
      if (error instanceof Error && error.message?.includes('categories_status_check')) {
        console.log("✅ PASS: Constraint correctly rejected invalid status");
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.log("⚠️  UNEXPECTED ERROR:", message);
        allPassed = false;
      }
    }

    // Test 2: Insert valid status (should succeed)
    console.log("\nTest 2: Inserting valid status (should succeed)...");
    try {
      await db.execute(sql`
        INSERT INTO categories (name, slug, status) 
        VALUES ('Test Category', 'test-valid-${Date.now()}', 'draft')
        ON CONFLICT (slug) DO NOTHING
      `);
      console.log("✅ PASS: Valid status accepted");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("❌ FAIL: Valid status rejected:", message);
      allPassed = false;
    }

    // Test 3: Verify all three constraints exist
    console.log("\nTest 3: Verifying all CHECK constraints exist...");
    const result = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*) as count
      FROM pg_constraint
      WHERE conname IN ('categories_status_check', 'pages_status_check', 'tags_status_check')
    `);

    const count = Number(result.rows[0]?.count || 0);
    if (count === 3) {
      console.log(`✅ PASS: All 3 CHECK constraints are present`);
    } else {
      console.log(`❌ FAIL: Only ${count}/3 constraints found`);
    }

    console.log("\n" + "=".repeat(60));
    if (allPassed) {
      console.log("✅ Database constraints are working correctly!");
    }
    console.log("=".repeat(60));

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Verification failed:", message);
    process.exit(1);
  }
}

main();
