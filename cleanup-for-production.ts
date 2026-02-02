import { db } from "./db/index.ts";
import { detectives, users, services } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function cleanupSystem() {
  // Delete all detectives and related data
  const allDetectives = await db.select().from(detectives);
  
  for (const detective of allDetectives) {
    console.log(`Deleting: ${detective.businessName}`);
    
    // Delete services first
    await db.delete(services).where(eq(services.detectiveId, detective.id));
    
    // Delete detective
    await db.delete(detectives).where(eq(detectives.id, detective.id));
  }
  
  // Keep only admin users
  const keepAdmins = await db.select().from(users).where(eq(users.role, "admin"));
  console.log(`\nKeeping ${keepAdmins.length} admin user(s)`);
  
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    if (user.role !== "admin") {
      console.log(`Deleting user: ${user.email}`);
      await db.delete(users).where(eq(users.id, user.id));
    }
  }
  
  // Final state
  const remainingDetectives = await db.select().from(detectives);
  const remainingServices = await db.select().from(services);
  const remainingUsers = await db.select().from(users);
  
  console.log(`\n✅ PRODUCTION READY STATE:`);
  console.log(`   - Detectives: ${remainingDetectives.length}`);
  console.log(`   - Services: ${remainingServices.length}`);
  console.log(`   - Users: ${remainingUsers.length} (admins only)`);
  
  process.exit(0);
}

cleanupSystem();
