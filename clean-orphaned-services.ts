import { db } from "./db/index.ts";
import { services, detectives } from "./shared/schema.ts";
import { sql, notInArray } from "drizzle-orm";

async function cleanOrphanedServices() {
  // Get all detective IDs
  const existingDetectives = await db.select({ id: detectives.id }).from(detectives);
  const detectiveIds = existingDetectives.map(d => d.id);
  
  console.log(`Existing detectives: ${detectiveIds.length}`);
  
  // Delete services where detective doesn't exist
  if (detectiveIds.length === 0) {
    // Delete all services if no detectives exist
    const result = await db.delete(services);
    console.log(`Deleted ALL ${result.rowCount} orphaned services (no detectives exist)`);
  } else {
    const result = await db.delete(services).where(notInArray(services.detectiveId, detectiveIds));
    console.log(`Deleted ${result.rowCount} orphaned services`);
  }
  
  // Verify
  const remaining = await db.select().from(services);
  console.log(`\n✅ Remaining services: ${remaining.length}`);
  
  process.exit(0);
}

cleanOrphanedServices();
