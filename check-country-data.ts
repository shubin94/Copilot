import { db } from "./db/index";
import { detectives, services } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkCountryData() {
  try {
    // Check detectives with country 'IN'
    const result = await db.select().from(detectives).where(eq(detectives.country, 'IN')).limit(5);
    console.log("Detectives with country='IN':", result.length);
    if (result.length > 0) {
      console.log("Sample detective:");
      console.log("  Business name:", result[0].businessName);
      console.log("  Country:", result[0].country);
      console.log("  Location:", result[0].location);
      console.log("  State:", result[0].state);
      console.log("  City:", result[0].city);
      
      // Check services for these detectives
      const serviceResult = await db.select().from(services)
        .where(eq(services.detectiveId, result[0].id));
      console.log("\nServices for this detective:", serviceResult.length);
    }
    
    // Check what country codes actually exist
    const allCountries = await db.selectDistinct({ country: detectives.country })
      .from(detectives)
      .limit(10);
    console.log("\nAll country codes in database:", allCountries.map(r => r.country));
    
    // Check active services
    const activeServices = await db.select()
      .from(services)
      .where(eq(services.isActive, true))
      .limit(10);
    console.log("\nTotal active services:", activeServices.length);
    
    if (activeServices.length > 0) {
      console.log("Sample active service:", {
        id: activeServices[0].id,
        title: activeServices[0].title,
        detectiveId: activeServices[0].detectiveId,
        images: activeServices[0].images
      });
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkCountryData();
