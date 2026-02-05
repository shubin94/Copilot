import "dotenv/config";
import { db } from "../db/index.ts";
import { services, detectives, users } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function testDeleteService() {
  try {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("🧪 TEST: Delete Service");
    console.log("═══════════════════════════════════════════════════════\n");

    // Get first detective
    const detective = await db.query.detectives.findFirst();
    if (!detective) {
      console.log("❌ No detectives found");
      process.exit(1);
    }

    console.log(`✅ Found detective: ${detective.businessName}`);

    // Get first service for this detective
    const service = await db.query.services.findFirst({
      where: eq(services.detectiveId, detective.id),
    });

    if (!service) {
      console.log("❌ No services found for this detective");
      process.exit(1);
    }

    console.log(`✅ Found service: ${service.title}`);
    console.log(`   Service ID: ${service.id}`);
    console.log(`   Detective ID: ${service.detectiveId}`);

    // Try to delete the service
    console.log(`\n🔄 Attempting to delete service...`);
    const result = await db.delete(services).where(eq(services.id, service.id));

    if (result.rowCount! > 0) {
      console.log(`✅ Successfully deleted service`);
      
      // Verify deletion
      const remaining = await db.query.services.findFirst({
        where: eq(services.id, service.id),
      });

      if (!remaining) {
        console.log(`✅ Verified: Service no longer exists in database`);
      } else {
        console.log(`❌ Service still exists (unexpected)`);
      }
    } else {
      console.log(`❌ Delete operation returned 0 rows affected`);
    }

    console.log("\n═══════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testDeleteService();
