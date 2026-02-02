import { db } from "./db/index.ts";
import { users } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function deleteAdminUser() {
  const adminUser = await db.query.users.findFirst({
    where: eq(users.email, "admin@askdetectives.com"),
  });
  
  if (!adminUser) {
    console.log("admin@askdetectives.com not found");
    process.exit(1);
  }
  
  console.log(`Found: ${adminUser.email} (${adminUser.role})`);
  console.log("Deleting...");
  
  const result = await db.delete(users).where(eq(users.id, adminUser.id));
  console.log(`✅ Deleted ${result.rowCount} user`);
  
  // Show remaining users
  const remaining = await db.select().from(users);
  console.log(`\n✅ Remaining users: ${remaining.length}`);
  remaining.forEach(u => {
    console.log(`   - ${u.email} (${u.role})`);
  });
  
  process.exit(0);
}

deleteAdminUser();
