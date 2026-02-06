import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { detectives, paymentOrders } from "../shared/schema.ts";
import { eq, desc } from "drizzle-orm";

const detectiveId = "108db626-e2f6-4d0e-be6c-8aefd3d93e8d";

async function recover() {
  try {
    console.log("🔧 RECOVERY PROCEDURE\n");
    
    // Get last paid order (most recent by timestamp)
    const paidOrders = await db.select()
      .from(paymentOrders)
      .where(eq(paymentOrders.detectiveId, detectiveId))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(100);
    
    const paidOnly = paidOrders.filter(o => o.status === "paid");
    
    if (paidOnly.length === 0) {
      console.log("❌ No paid orders found for this detective");
      process.exit(1);
    }
    
    const lastPaid = paidOnly[0]; // Most recent paid order
    console.log(`📋 Found last paid order: ${lastPaid.id}`);
    console.log(`   Package ID: ${lastPaid.packageId}`);
    console.log(`   Billing Cycle: ${lastPaid.billingCycle}`);
    console.log(`   Amount: ${lastPaid.amount}`);
    console.log(`   Created: ${lastPaid.createdAt}`);
    
    // Update detective
    console.log(`\n⏳ Updating detective...`);
    const now = new Date();
    
    const result = await db.update(detectives)
      .set({
        subscriptionPackageId: lastPaid.packageId,
        billingCycle: lastPaid.billingCycle as any,
        subscriptionActivatedAt: now,
      })
      .where(eq(detectives.id, detectiveId));
    
    console.log(`✅ Detective updated!`);
    
    // Verify the update
    const updated = await db.select()
      .from(detectives)
      .where(eq(detectives.id, detectiveId))
      .limit(1);
    
    if (updated.length > 0) {
      const d = updated[0];
      console.log(`\n📊 DETECTIVE STATE AFTER UPDATE:`);
      console.log(`   ID: ${d.id}`);
      console.log(`   Business: ${d.businessName}`);
      console.log(`   Package ID: ${d.subscriptionPackageId}`);
      console.log(`   Billing Cycle: ${d.billingCycle}`);
      console.log(`   Activated At: ${d.subscriptionActivatedAt}`);
    }
    
    console.log(`\n✨ Recovery complete!`);
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

recover();
