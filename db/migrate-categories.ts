import { db } from "./index";
import { services, serviceCategories } from "../shared/schema.ts";
import { eq, sql } from "drizzle-orm";

/**
 * Migration script to convert service.category (text) to service.categoryId (foreign key)
 * 
 * This script:
 * 1. Fetches all services with text category values
 * 2. For each unique category, finds or creates a matching serviceCategory record
 * 3. Updates all services to use the new categoryId
 */
async function migrateCategories() {
  console.log("🔄 Starting category migration...");

  try {
    // Check if the old 'category' column exists
    const hasOldColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'services' AND column_name = 'category'
    `);

    if (hasOldColumn.rows.length === 0) {
      console.log("✅ Migration already completed - 'category' column no longer exists");
      return;
    }

    // Fetch all services with their text category values
    const servicesWithCategories = await db.execute(sql`
      SELECT id, category FROM services WHERE category IS NOT NULL
    `);

    if (servicesWithCategories.rows.length === 0) {
      console.log("✅ No services to migrate");
      return;
    }

    console.log(`📊 Found ${servicesWithCategories.rows.length} services to migrate`);

    // Get all unique category names
    const uniqueCategories = [...new Set(
      servicesWithCategories.rows.map((row: any) => row.category).filter(Boolean)
    )] as string[];

    console.log(`📋 Unique categories found: ${uniqueCategories.join(", ")}`);

    // For each unique category, find or create a serviceCategory record
    const categoryMapping = new Map<string, string>();

    for (const categoryName of uniqueCategories) {
      // Try to find existing category
      const [existingCategory] = await db
        .select()
        .from(serviceCategories)
        .where(eq(serviceCategories.name, categoryName))
        .limit(1);

      if (existingCategory) {
        categoryMapping.set(categoryName, existingCategory.id);
        console.log(`✓ Found existing category: ${categoryName} (${existingCategory.id})`);
      } else {
        // Create new category
        const [newCategory] = await db
          .insert(serviceCategories)
          .values({
            name: categoryName,
            description: `${categoryName} investigation services`,
            isActive: true,
          })
          .returning();

        categoryMapping.set(categoryName, newCategory.id);
        console.log(`✓ Created new category: ${categoryName} (${newCategory.id})`);
      }
    }

    // Update each service with the correct categoryId
    let updatedCount = 0;
    for (const row of servicesWithCategories.rows as any[]) {
      const categoryId = categoryMapping.get(row.category);
      if (categoryId) {
        await db.execute(sql`
          UPDATE services SET category_id = ${categoryId} WHERE id = ${row.id}
        `);
        updatedCount++;
      }
    }

    console.log(`✅ Updated ${updatedCount} services with categoryId`);
    console.log("\n🎉 Migration completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Run: npm run db:push -- --force");
    console.log("2. This will remove the old 'category' column and enforce the foreign key constraint");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

migrateCategories()
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
