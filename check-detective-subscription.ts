import { db } from "./db/index.ts";
import { subscriptionPlans, detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

const detectiveId = '108db626-e2f6-4d0e-be6c-8aefd3d93e8d';

async function check() {
  console.log('\n=== SUBSCRIPTION PLANS ===');
  const plans = await db.select().from(subscriptionPlans);
  plans.forEach(p => {
    console.log(`${p.id} | ${p.name} | Active: ${p.isActive} | Features: ${JSON.stringify(p.features)}`);
  });

  console.log('\n=== DETECTIVE ===');
  const [detective] = await db.select().from(detectives).where(eq(detectives.id, detectiveId));
  if (detective) {
    console.log(`ID: ${detective.id}`);
    console.log(`Business: ${detective.businessName}`);
    console.log(`Package ID: ${detective.subscriptionPackageId}`);
    console.log(`Subscription Plan (legacy): ${detective.subscriptionPlan}`);
    
    if (detective.subscriptionPackageId) {
      const [pkg] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, detective.subscriptionPackageId));
      if (pkg) {
        console.log(`\nPackage Found: ${pkg.name}`);
        console.log(`Features: ${JSON.stringify(pkg.features)}`);
        console.log(`Badges: ${JSON.stringify(pkg.badges)}`);
      } else {
        console.log('\n❌ PACKAGE NOT FOUND IN DATABASE!');
      }
    }
  } else {
    console.log('Detective not found');
  }
  
  process.exit(0);
}

check();
