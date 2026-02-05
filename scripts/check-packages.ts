import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { subscriptionPlans } from "../shared/schema.ts";

const plans = await db.select().from(subscriptionPlans);
console.log('All packages:');
plans.forEach(p => {
  console.log(`- ${p.name} (${p.displayName}): ID=${p.id}`);
  console.log(`  Monthly=${p.monthlyPrice}, Yearly=${p.yearlyPrice}, Active=${p.isActive}`);
});
process.exit(0);
