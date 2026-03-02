import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { services, detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function main() {
  try {
    console.log("\n=== CHECKING CATEGORIES & SERVICES ===\n");

    // Get all unique categories
    const allServices = await db.select({ category: services.category }).from(services);
    const uniqueCategories = [...new Set(allServices.map(s => s.category))];
    console.log("📁 Unique Categories in database:");
    uniqueCategories.forEach(cat => console.log(`  - ${cat}`));

    // Check specific category
    const premarriageServices = await db
      .select({
        id: services.id,
        title: services.title,
        category: services.category,
        isActive: services.isActive,
        detectiveId: services.detectiveId,
      })
      .from(services)
      .where(eq(services.category, "Pre-marriage investigations"));

    console.log(`\n🔍 Services in "Pre-marriage investigations" category: ${premarriageServices.length}`);
    if (premarriageServices.length > 0) {
      premarriageServices.forEach(s => {
        console.log(`  - [${s.id}] ${s.title} (isActive: ${s.isActive}, detectiveId: ${s.detectiveId})`);
      });
    }

    // Check if there are any services AT ALL
    const totalServices = await db.select({ id: services.id }).from(services);
    console.log(`\n📊 Total services in database: ${totalServices.length}`);

    // Check active services
    const activeServices = await db
      .select({ 
        id: services.id,
        category: services.category,
      })
      .from(services)
      .where(eq(services.isActive, true));
    console.log(`✅ Active services: ${activeServices.length}`);

    // Group active by category
    const activeByCat: Record<string, number> = {};
    activeServices.forEach(s => {
      activeByCat[s.category] = (activeByCat[s.category] || 0) + 1;
    });
    console.log("\n📈 Active services by category:");
    Object.entries(activeByCat).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count}`);
    });

  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();
