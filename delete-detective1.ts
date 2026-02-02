import { db } from "./db/index.ts";
import { detectives, users } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function deleteDetective1() {
  // Find Detective 1 Agency
  const detective = await db.query.detectives.findFirst({
    where: eq(detectives.businessName, "Detective 1 Agency"),
  });
  
  if (!detective) {
    console.log("Detective 1 Agency not found");
    process.exit(1);
  }
  
  console.log(`Found: ${detective.businessName}`);
  console.log(`Deleting user (cascades to detective and services)...`);
  
  // Delete the user (cascades to detective, services, etc.)
  const result = await db.delete(users).where(eq(users.id, detective.userId));
  console.log(`✅ Deleted ${result.rowCount} user (cascaded to detective and all related records)`);
  
  // Verify
  const remaining = await db.select().from(detectives);
  console.log(`\n✅ Remaining detectives: ${remaining.length}`);
  
  const remainingUsers = await db.select().from(users);
  console.log(`✅ Remaining users: ${remainingUsers.length}`);
  
  process.exit(0);
}

deleteDetective1();
