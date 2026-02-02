import { db } from "./db/index.ts";
import { services, detectives } from "./shared/schema.ts";
import { sql } from "drizzle-orm";

async function checkOrphanedServices() {
  // Get all services
  const allServices = await db.select({
    id: services.id,
    title: services.title,
    detectiveId: services.detectiveId,
  }).from(services);
  
  console.log(`Total services in DB: ${allServices.length}\n`);
  
  // Check each service for detective existence
  for (const service of allServices) {
    const detective = await db.select().from(detectives).where(sql`${detectives.id} = ${service.detectiveId}`).limit(1);
    
    if (detective.length === 0) {
      console.log(`❌ ORPHANED SERVICE: ${service.title}`);
      console.log(`   Service ID: ${service.id}`);
      console.log(`   Detective ID: ${service.detectiveId} (DOES NOT EXIST)\n`);
    } else {
      console.log(`✅ ${service.title} - Detective: ${detective[0].businessName}\n`);
    }
  }
  
  process.exit(0);
}

checkOrphanedServices();
