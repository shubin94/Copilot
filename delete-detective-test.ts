import { db } from "./db/index.ts";
import { detectives, users } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function deleteDetective() {
  // Find Detective 2 Agency
  const detective = await db.query.detectives.findFirst({
    where: eq(detectives.businessName, "Detective 2 Agency"),
  });
  
  if (!detective) {
    console.log("Detective 2 Agency not found");
    process.exit(1);
  }
  
  console.log(`Found detective: ${detective.businessName} (ID: ${detective.id}, User ID: ${detective.userId})`);
  console.log("Deleting...");
  
  // Delete the user (should cascade delete detective and related records)
  const result = await db.delete(users).where(eq(users.id, detective.userId));
  
  console.log(`Deletion result: ${result.rowCount} user(s) deleted`);
  
  // Verify deletion
  const checkDetective = await db.query.detectives.findFirst({
    where: eq(detectives.id, detective.id),
  });
  
  if (checkDetective) {
    console.log("❌ FAILED: Detective still exists in database!");
  } else {
    console.log("✅ SUCCESS: Detective deleted from database");
  }
  
  // Count remaining detectives
  const remaining = await db.select().from(detectives);
  console.log(`\nRemaining detectives in DB: ${remaining.length}`);
  remaining.forEach((d, i) => {
    console.log(`${i + 1}. ${d.businessName} - Status: ${d.status}`);
  });
  
  process.exit(0);
}

deleteDetective();
