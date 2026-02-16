import { db } from "./db/index.ts";
import { services } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function checkSlugs() {
  try {
    // Check services with and without slugs
    const allServices = await db.select({
      id: services.id,
      title: services.title,
      slug: services.slug,
    }).from(services).limit(10);

    console.log("Sample services:");
    allServices.forEach(s => {
      console.log(` - ID: ${s.id.substring(0, 8)}... | Title: ${s.title} | Slug: ${s.slug || 'MISSING'}`);
    });

    // Count services with slugs
    const withSlug = await db.select({ count: allServices.length }).from(services);
    const withoutSlug = allServices.filter(s => !s.slug).length;
    
    console.log(`\nTotal checked: ${allServices.length}`);
    console.log(`Services with slugs: ${allServices.length - withoutSlug}`);
    console.log(`Services without slugs: ${withoutSlug}`);
    
    if (withoutSlug === 0) {
      console.log("\n✅ All services have slugs!");
    } else {
      console.log(`\n⚠️ ${withoutSlug} services are missing slugs. Run the population script.`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

checkSlugs();
