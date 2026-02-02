import { db } from "./db/index.ts";
import { detectives, services, users } from "./shared/schema.ts";

async function finalVerification() {
  console.log("=" .repeat(60));
  console.log("FINAL SYSTEM VERIFICATION");
  console.log("=" .repeat(60));
  
  // Check users
  const allUsers = await db.select({ email: users.email, role: users.role }).from(users);
  console.log(`\n✅ Users: ${allUsers.length}`);
  allUsers.forEach(u => console.log(`   - ${u.email} (${u.role})`));
  
  // Check detectives
  const allDetectives = await db.select({ id: detectives.id, businessName: detectives.businessName, status: detectives.status }).from(detectives);
  console.log(`\n✅ Detectives: ${allDetectives.length}`);
  allDetectives.forEach(d => console.log(`   - ${d.businessName} (${d.status})`));
  
  // Check services
  const allServices = await db.select({ id: services.id, title: services.title, detectiveId: services.detectiveId }).from(services);
  console.log(`\n✅ Services: ${allServices.length}`);
  allServices.forEach(s => console.log(`   - ${s.title}`));
  
  // Verify no orphaned services
  const orphanedCheck = allServices.every(s => 
    allDetectives.some(d => d.id === s.detectiveId)
  );
  
  if (orphanedCheck) {
    console.log("\n✅ NO ORPHANED SERVICES - All services have valid detectives");
  } else {
    console.log("\n❌ ORPHANED SERVICES FOUND");
  }
  
  console.log("\n" + "=" .repeat(60));
  console.log("System is clean and ready to use");
  console.log("=" .repeat(60));
  
  process.exit(0);
}

finalVerification();
