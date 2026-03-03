import { db } from "./db/index.ts";
import { detectives, services } from "./shared/schema.ts";
import { like, eq } from "drizzle-orm";

async function checkSukanSlugs() {
  try {
    console.log("Checking for 'sukan agency' detective...\n");
    
    // Find the detective
    const detectiveResults = await db.select().from(detectives).where(like(detectives.businessName, '%sukan%')).limit(1);
    
    if (!detectiveResults || detectiveResults.length === 0) {
      console.log("❌ Detective 'sukan agency' not found!");
      return;
    }

    const detective = detectiveResults[0];

    console.log("✅ Found detective:");
    console.log("  ID:", detective.id);
    console.log("  Business Name:", detective.businessName);
    console.log("  Slug:", detective.slug || "❌ MISSING");
    console.log("  Country:", detective.country);
    console.log("  State:", detective.state);
    console.log("  City:", detective.city);
    
    // Find services for this detective
    console.log("\nServices:");
    const serviceResults = await db.select().from(services).where(eq(services.detectiveId, detective.id));
    
    if (!serviceResults || serviceResults.length === 0) {
      console.log("  ❌ No services found");
    } else {
      serviceResults.forEach((service, index) => {
        console.log(`\n  Service ${index + 1}:`);
        console.log(`    ID: ${service.id}`);
        console.log(`    Title: ${service.title}`);
        console.log(`    Slug: ${service.slug || "❌ MISSING"}`);
      });
    }

    // Check if slugs are missing
    const missingSlugs: string[] = [];
    if (!detective.slug) {
      missingSlugs.push("detective slug");
    }
    if (serviceResults) {
      serviceResults.forEach(service => {
        if (!service.slug) {
          missingSlugs.push(`service "${service.title}" slug`);
        }
      });
    }

    if (missingSlugs.length > 0) {
      console.log("\n⚠️  MISSING SLUGS:");
      missingSlugs.forEach(item => console.log(`   - ${item}`));
      console.log("\nThis is why the service card shows '#' and is not clickable!");
    } else {
      console.log("\n✅ All slugs present - card should be clickable");
    }

  } catch (error) {
    console.error("Error checking slugs:", error);
  } finally {
    process.exit(0);
  }
}

checkSukanSlugs();
