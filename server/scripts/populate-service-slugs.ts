import { db } from "../../db/index.ts";
import { services } from "../../shared/schema.ts";
import { eq } from "drizzle-orm";

/**
 * Generate a URL-safe slug from text
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Populate slug column for services that don't have one
 */
export async function populateSlugs() {
  try {
    console.log("Starting slug population...");

    // Get all services without slugs
    const allServices = await db.select().from(services);
    const servicesWithoutSlug = allServices.filter(s => !s.slug);

    if (servicesWithoutSlug.length === 0) {
      console.log("✅ All services already have slugs");
      return;
    }

    console.log(`Found ${servicesWithoutSlug.length} services needing slugs`);

    const slugMap = new Map<string, number>(); // Track slug counts to avoid duplicates

    for (const service of servicesWithoutSlug) {
      let slug = generateSlug(service.title);
      
      // Handle duplicates by appending a counter
      const originalSlug = slug;
      let count = 1;
      while (slugMap.has(slug)) {
        slug = `${originalSlug}-${count}`;
        count++;
      }
      slugMap.set(slug, count);

      // Update the service with the generated slug
      await db.update(services)
        .set({ slug })
        .where(eq(services.id, service.id));

      console.log(`  ✓ ${service.title} → ${slug}`);
    }

    console.log(`✅ Successfully populated ${servicesWithoutSlug.length} service slugs`);
  } catch (error) {
    console.error("Error populating slugs:", error);
    throw error;
  }
}

// Run if this is the main module
if (process.argv[1] && process.argv[1].includes("populate-service-slugs")) {
  try {
    await populateSlugs();
    process.exit(0);
  } catch (error) {
    console.error("Failed to populate slugs:", error);
    process.exit(1);
  }
}
