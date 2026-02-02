import { db } from "./db/index.ts";
import { detectives, services } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function forceDeleteDetective() {
  const detective = await db.query.detectives.findFirst({
    where: eq(detectives.businessName, "Detective 2 Agency"),
  });
  
  if (!detective) {
    console.log("Detective not found");
    process.exit(1);
  }
  
  console.log(`Deleting Detective 2 Agency (ID: ${detective.id})`);
  
  // Delete services first (will cascade delete packages, reviews, etc.)
  const serviceResult = await db.delete(services).where(eq(services.detectiveId, detective.id));
  console.log(`Deleted ${serviceResult.rowCount} service(s)`);
  
  // Delete detective directly
  const detectiveResult = await db.delete(detectives).where(eq(detectives.id, detective.id));
  console.log(`Deleted ${detectiveResult.rowCount} detective(s)`);
  
  // Verify
  const remaining = await db.select().from(detectives);
  console.log(`\n✅ Remaining detectives: ${remaining.length}`);
  remaining.forEach((d, i) => {
    console.log(`${i + 1}. ${d.businessName} - Status: ${d.status}`);
  });
  
  process.exit(0);
}

forceDeleteDetective();
