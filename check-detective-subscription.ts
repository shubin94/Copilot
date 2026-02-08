import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { subscriptionPlans, detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

const detectiveId = '108db626-e2f6-4d0e-be6c-8aefd3d93e8d';

async function check() {
  try {
    console.log('\n=== SUBSCRIPTION PLANS ===');
    const plans = await db.select().from(subscriptionPlans);
    plans.forEach(p => {
      console.log(`${p.id} | ${p.name} | Active: ${p.isActive} | Features: ${JSON.stringify(p.features)}`);
    });

    console.log('\n=== DETECTIVE ===');
    const detectives_result = await db.select().from(detectives).where(eq(detectives.id, detectiveId));
    const detective = detectives_result && detectives_result.length > 0 ? detectives_result[0] : null;
    if (!detective) {
      throw new Error(`Detective not found: ${detectiveId}`);
    }
    
    console.log(`ID: ${detective.id}`);
    console.log(`Business: ${detective.businessName}`);
    console.log(`Package ID: ${detective.subscriptionPackageId}`);
    // temporary: prints legacy subscriptionPlan for pre-migration diagnostics
      
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
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
