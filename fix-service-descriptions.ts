import "dotenv/config";
import { db } from "./db/index.ts";
import { services, detectives, users } from "./shared/schema.ts";
import { eq, sql } from "drizzle-orm";

async function fixServiceDescriptions() {
  console.log("Fixing service descriptions...\n");

  // Get all services with the incorrect description
  const incorrectServices = await db
    .select({
      serviceId: services.id,
      serviceTitle: services.title,
      serviceCategory: services.category,
      detectiveId: services.detectiveId,
      currentDescription: services.description,
    })
    .from(services)
    .where(eq(services.description, "Service from approved application"));

  console.log(`Found ${incorrectServices.length} services to update\n`);

  if (incorrectServices.length === 0) {
    console.log("No services to fix!");
    process.exit(0);
  }

  let updated = 0;
  let failed = 0;

  for (const service of incorrectServices) {
    try {
      // Get detective info to build proper description
      const detectiveData = await db
        .select({
          businessName: detectives.businessName,
          userName: users.name,
        })
        .from(detectives)
        .innerJoin(users, eq(detectives.userId, users.id))
        .where(eq(detectives.id, service.detectiveId))
        .limit(1);

      if (!detectiveData || detectiveData.length === 0) {
        console.log(`⚠️  Skipping service ${service.serviceId} - detective not found`);
        failed++;
        continue;
      }

      const detectiveName = detectiveData[0].businessName || detectiveData[0].userName;
      const category = service.serviceCategory || "investigation";

      // Build new description using the same template as auto-create
      const newDescription = `Professional ${category.toLowerCase()} services by ${detectiveName}. Contact for detailed consultation.`;

      // Update the service
      await db
        .update(services)
        .set({ 
          description: newDescription,
          updatedAt: new Date()
        })
        .where(eq(services.id, service.serviceId));

      updated++;
      if (updated % 100 === 0) {
        console.log(`Progress: ${updated}/${incorrectServices.length} updated...`);
      }
    } catch (error) {
      console.error(`❌ Failed to update service ${service.serviceId}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ COMPLETE`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${incorrectServices.length}`);

  process.exit(0);
}

fixServiceDescriptions().catch(console.error);
