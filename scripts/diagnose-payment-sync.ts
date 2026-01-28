import { db } from "../db/index.ts";
import { detectives, paymentOrders, subscriptionPlans } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

const detectiveId = "108db626-e2f6-4d0e-be6c-8aefd3d93e8d";

async function diagnose() {
  try {
    console.log("=== DIAGNOSTIC REPORT ===\n");
    
    // 1. Check detective's current subscription state
    console.log("1. DETECTIVE CURRENT STATE:");
    const detective = await db.select()
      .from(detectives)
      .where(eq(detectives.id, detectiveId))
      .limit(1);
    
    if (detective.length > 0) {
      const d = detective[0];
      console.log(`ID: ${d.id}`);
      console.log(`Business: ${d.businessName}`);
      console.log(`Subscription Plan (legacy): ${d.subscriptionPlan}`);
      console.log(`Subscription Package ID: ${d.subscriptionPackageId}`);
      console.log(`Billing Cycle: ${d.billingCycle}`);
      console.log(`Activated At: ${d.subscriptionActivatedAt}`);
    } else {
      console.log("Detective not found!");
      process.exit(1);
    }
    
    // 2. Check package info if subscriptionPackageId is set
    if (detective[0].subscriptionPackageId) {
      console.log("\n2. CURRENT PACKAGE INFO:");
      const pkg = await db.select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, detective[0].subscriptionPackageId!))
        .limit(1);
      
      if (pkg.length > 0) {
        console.log(`Package: ${pkg[0].name} (${pkg[0].displayName})`);
        console.log(`Active: ${pkg[0].isActive}`);
        console.log(`Monthly: ${pkg[0].monthlyPrice}, Yearly: ${pkg[0].yearlyPrice}`);
      }
    }
    
    // 3. Check recent payment orders for this detective
    console.log("\n3. RECENT PAYMENT ORDERS:");
    const payments = await db.select()
      .from(paymentOrders)
      .where(eq(paymentOrders.detectiveId, detectiveId))
      .limit(10);
    
    if (payments.length > 0) {
      console.log(`Found ${payments.length} payment orders:`);
      payments.forEach((p, i) => {
        console.log(`\n[${i + 1}] Status: ${p.status}, Package ID: ${p.packageId}, Cycle: ${p.billingCycle}`);
        console.log(`    Amount: ${p.amount} INR, Created: ${p.createdAt}`);
        console.log(`    Razorpay Order: ${p.razorpayOrderId}`);
        if (p.status === "paid") {
          console.log(`    Payment ID: ${p.paymentId}`);
        }
      });
    } else {
      console.log("No payment orders found");
    }
    
    // 4. Check if there's a mismatch between last paid order and detective
    console.log("\n4. PAYMENT vs DETECTIVE SYNC CHECK:");
    const paidOrders = payments.filter(p => p.status === "paid");
    
    if (paidOrders.length > 0) {
      const lastPaid = paidOrders[0];
      console.log(`Last paid order: ${lastPaid.id}`);
      console.log(`  Package ID in order: ${lastPaid.packageId}`);
      console.log(`  Billing cycle in order: ${lastPaid.billingCycle}`);
      console.log(`  Detective's current package: ${detective[0].subscriptionPackageId}`);
      console.log(`  Detective's current cycle: ${detective[0].billingCycle}`);
      
      if (lastPaid.packageId === detective[0].subscriptionPackageId && 
          lastPaid.billingCycle === detective[0].billingCycle) {
        console.log("  ✅ SYNC OK - Payment matches detective");
      } else {
        console.log("  ❌ OUT OF SYNC - Payment processed but detective NOT updated!");
        console.log("\n  This means /api/payments/verify was either:");
        console.log("    - Not called at all");
        console.log("    - Called but failed silently");
        console.log("    - Called but detective update failed");
      }
    } else {
      console.log("No paid payment orders found");
    }
    
    // 5. List available packages
    console.log("\n5. AVAILABLE PACKAGES:");
    const pkgs = await db.select().from(subscriptionPlans);
    
    pkgs.forEach(p => {
      console.log(`  ${p.isActive ? '✓' : '✗'} ${p.name.toUpperCase()}: ${p.id} (${p.displayName})`);
    });
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

diagnose();
