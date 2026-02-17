#!/usr/bin/env node

/**
 * Seeding Script: Generate Detective Profile Slugs
 * 
 * Purpose: Populate the new slug column for all detectives
 * Usage: DATABASE_URL="..." npx tsx scripts/generate-detective-slugs.ts
 * 
 * This script:
 * 1. Fetches all detectives without slugs
 * 2. Generates URL-friendly slugs using businessName + city
 * 3. Handles collisions by appending -1, -2, etc. (unlikely for global uniqueness)
 * 4. Updates database in batches (safer for large datasets)
 */

import { getDatabaseURL } from "../server/lib/env.ts";
import { db } from "../server/db.ts";
import { detectives } from "../shared/schema.ts";
import { eq, isNull } from "drizzle-orm";

// Slugify helper (matches frontend slugify behavior)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric except hyphen
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

async function generateDetectiveSlugsSEO() {
  try {
    console.log("[Seeding] Starting detective slug generation...\n");

    // Step 1: Fetch all detectives
    const allDetectives = await db.select().from(detectives);
    const detectivesNeedingSlug = allDetectives.filter(
      (d: any) => !d.slug || d.slug.trim() === ""
    );

    if (detectivesNeedingSlug.length === 0) {
      console.log("[Seeding] ✅ All detectives already have slugs. Exiting.");
      process.exit(0);
    }

    console.log(
      `[Seeding] Found ${detectivesNeedingSlug.length} detectives needing slug generation`
    );
    console.log(`[Seeding] Total detectives in database: ${allDetectives.length}\n`);

    // Step 2: Generate slugs with collision handling
    const slugCache = new Map<string, number>(); // Track slug usage for collisions
    const updates: Array<{ id: string; slug: string }> = [];

    for (const detective of detectivesNeedingSlug) {
      const businessName = detective.businessName || "Detective";
      const city = detective.city || "Services";
      
      // Generate base slug
      let slug = slugify(`${businessName} ${city}`);
      
      // Handle collisions (very rare, but safe)
      if (slugCache.has(slug)) {
        const count = (slugCache.get(slug) || 0) + 1;
        slugCache.set(slug, count);
        slug = `${slug}-${count}`;
      } else {
        slugCache.set(slug, 0);
      }

      updates.push({
        id: detective.id,
        slug,
      });

      // Log sample slugs
      if (updates.length <= 5 || updates.length % 100 === 0) {
        console.log(`  [${updates.length}] ${businessName} (${city}) → ${slug}`);
      }
    }

    console.log(
      `\n[Seeding] Generated ${updates.length} slugs (collisions handled)\n`
    );

    // Step 3: Batch update to database (10 at a time for safety)
    const BATCH_SIZE = 10;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

      try {
        await Promise.all(
          batch.map((u) =>
            db
              .update(detectives)
              .set({ slug: u.slug })
              .where(eq(detectives.id, u.id))
          )
        );
        successCount += batch.length;

        // Progress indicator
        const percent = Math.floor((successCount / updates.length) * 100);
        console.log(
          `[Seeding] Batch ${batchNum}/${totalBatches} ✅ (${percent}% complete)`
        );
      } catch (error) {
        errorCount += batch.length;
        console.error(
          `[Seeding] ❌ Batch ${batchNum} failed:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Step 4: Verification
    console.log("\n[Seeding] Verifying slug generation...\n");
    const verification = await db.select().from(detectives);
    const stillMissing = verification.filter((d: any) => !d.slug || d.slug.trim() === "");

    if (stillMissing.length > 0) {
      console.error(
        `[Seeding] ❌ ${stillMissing.length} detectives still missing slugs:`
      );
      stillMissing.slice(0, 5).forEach((d: any) => {
        console.error(`  - ${d.businessName} (ID: ${d.id})`);
      });
      process.exit(1);
    }

    console.log(
      `[Seeding] ✅ All detectives have slugs!\n`
    );
    console.log(`[Seeding] Summary:`);
    console.log(`  - Successfully updated: ${successCount}`);
    console.log(`  - Failed: ${errorCount}`);
    console.log(`  - Total verified: ${verification.filter((d: any) => d.slug).length}/${verification.length}`);
    console.log(`\n[Seeding] 🎉 Detective slug generation complete!`);

    process.exit(0);
  } catch (error) {
    console.error("[Seeding] Fatal error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run with proper error handling
generateDetectiveSlugsSEO().catch((error) => {
  console.error("[Seeding] Unhandled error:", error);
  process.exit(1);
});
