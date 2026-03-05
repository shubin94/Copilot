import "./server/lib/loadEnv.js";
import { db } from "./db/index.ts";
import { services } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function populateSlugs() {
  try {
    console.log("Starting slug population...");
    
    const allServices = await db.select().from(services);
    console.log(`Total services in database: ${allServices.length}`);
    
    const servicesWithoutSlug = allServices.filter(s => !s.slug);
    console.log(`Services without slugs: ${servicesWithoutSlug.length}`);

    if (servicesWithoutSlug.length === 0) {
      console.log("✅ All services already have slugs");
      process.exit(0);
    }

    const slugMap = new Map<string, number>();
    let successCount = 0;

    for (const service of servicesWithoutSlug) {
      let slug = generateSlug(service.title);
      
      const originalSlug = slug;
      let count = 1;
      while (slugMap.has(slug)) {
        slug = `${originalSlug}-${count}`;
        count++;
      }
      slugMap.set(slug, count);

      try {
        await db.update(services)
          .set({ slug })
          .where(eq(services.id, service.id));
        
        console.log(`  ✓ ${service.title} → ${slug}`);
        successCount++;
      } catch (updateError) {
        console.error(`  ✗ Failed to update service ${service.id}:`, updateError);
      }
    }

    console.log(`\n✅ Successfully populated ${successCount} service slugs`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error populating slugs:", error);
    process.exit(1);
  }
}

populateSlugs();
