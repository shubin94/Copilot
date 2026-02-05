import { db } from "./db/index";
import { subscriptionPlans } from "./shared/schema";
import { eq, ne, sql } from "drizzle-orm";

async function run() {
  const plans = await db.select().from(subscriptionPlans);
  for (const plan of plans) {
    const features = Array.isArray(plan.features) ? plan.features : [];
    const isFree = (plan.name || "").toLowerCase() === "free" || String(plan.monthlyPrice) === "0";
    if (isFree) continue;
    if (!features.includes("contact_website")) {
      const next = [...features, "contact_website"];
      await db.update(subscriptionPlans)
        .set({ features: next, updatedAt: new Date() })
        .where(eq(subscriptionPlans.id, plan.id));
      console.log(`Updated plan ${plan.name}: added contact_website`);
    }
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
