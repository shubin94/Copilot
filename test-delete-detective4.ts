import { db } from "./db/index.ts";
import { detectives, users, services, orders, profileClaims, paymentOrders } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function testDelete() {
  const detective = await db.query.detectives.findFirst({
    where: eq(detectives.businessName, "Detective 4 Agency"),
  });
  
  if (!detective) {
    console.log("Detective 4 Agency not found");
    process.exit(1);
  }
  
  console.log(`Detective ID: ${detective.id}`);
  console.log(`User ID: ${detective.userId}`);
  
  // Check if user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, detective.userId),
  });
  
  if (!user) {
    console.log("❌ User does not exist - orphaned detective");
    // Delete directly
    console.log("Deleting orphaned detective...");
    const result = await db.delete(detectives).where(eq(detectives.id, detective.id));
    console.log(`Deleted ${result.rowCount} detective(s)`);
  } else {
    console.log(`✅ User exists: ${user.email}`);
    
    // Check for blocking records
    const relatedServices = await db.select().from(services).where(eq(services.detectiveId, detective.id));
    console.log(`Related services: ${relatedServices.length}`);
    
    const relatedOrders = await db.select().from(orders).where(eq(orders.detectiveId, detective.id));
    console.log(`Related orders: ${relatedOrders.length}`);
    
    const relatedClaims = await db.select().from(profileClaims).where(eq(profileClaims.detectiveId, detective.id));
    console.log(`Related claims: ${relatedClaims.length}`);
    
    const relatedPayments = await db.select().from(paymentOrders).where(eq(paymentOrders.detectiveId, detective.id));
    console.log(`Related payment orders: ${relatedPayments.length}`);
    
    console.log("\nAttempting deletion...");
    try {
      const result = await db.delete(users).where(eq(users.id, detective.userId));
      console.log(`✅ Deleted ${result.rowCount} user(s)`);
    } catch (error: any) {
      console.log("❌ Deletion failed:", error.message);
    }
  }
  
  process.exit(0);
}

testDelete();
