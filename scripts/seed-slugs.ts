import "dotenv/config";
import { db as getDb } from "../db/index.ts";
import * as schema from "../shared/schema.ts";
import { eq, isNull } from "drizzle-orm";

const db = getDb;

function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateRandomSuffix(): string {
  return Math.floor(Math.random() * 900 + 100).toString();
}

async function seedSlugs() {
  try {
    console.log("✅ Seeding detective slugs...\n");

    // Fetch all detectives with null slug
    const detectivesWithoutSlugs = await db
      .select()
      .from(schema.detectives)
      .where(isNull(schema.detectives.slug));

    console.log(
      `Found ${detectivesWithoutSlugs.length} detectives without slugs\n`
    );

    if (detectivesWithoutSlugs.length === 0) {
      console.log("✅ All detectives already have slugs!");
      process.exit(0);
    }

    let successCount = 0;
    let failureCount = 0;

    for (const detective of detectivesWithoutSlugs) {
      try {
        let slug = slugify(detective.business_name || "detective");

        // Check if slug already exists
        let exists = await db
          .select()
          .from(schema.detectives)
          .where(eq(schema.detectives.slug, slug))
          .limit(1);

        // If slug exists, append random suffix
        let attempts = 0;
        while (exists.length > 0 && attempts < 10) {
          slug = `${slugify(
            detective.business_name || "detective"
          )}-${generateRandomSuffix()}`;
          exists = await db
            .select()
            .from(schema.detectives)
            .where(eq(schema.detectives.slug, slug))
            .limit(1);
          attempts++;
        }

        // Update detective with new slug
        await db
          .update(schema.detectives)
          .set({ slug })
          .where(eq(schema.detectives.id, detective.id));

        successCount++;
        console.log(`  ✓ ${detective.business_name} → ${slug}`);
      } catch (error) {
        failureCount++;
        console.error(
          `  ✗ Failed to seed slug for ${detective.business_name}:`,
          error
        );
      }
    }

    console.log(
      `\n✅ Successfully seeded ${successCount} detectives with slugs`
    );
    if (failureCount > 0) {
      console.log(`❌ Failed: ${failureCount}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding slugs:", error);
    process.exit(1);
  }
}

seedSlugs();
