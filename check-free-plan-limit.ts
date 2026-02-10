import "dotenv/config";
import { db } from "./db/index";
import { subscriptionPlans } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkFreePlanLimit() {
  try {
    const freePlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, "free")
    });

    if (freePlan) {
      console.log("✅ Free plan found:");
      console.log(`   Service Limit: ${freePlan.serviceLimit}`);
      console.log(`   Display Name: ${freePlan.displayName}`);
    } else {
      console.log("❌ No 'free' plan found in database");
      console.log("\nAll plans:");
      const allPlans = await db.select().from(subscriptionPlans);
      allPlans.forEach(p => {
        console.log(`   - ${p.name}: serviceLimit = ${p.serviceLimit}`);
      });
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkFreePlanLimit();
