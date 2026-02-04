import { db } from "./db/index.ts";
import { detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

const detectiveId = '108db626-e2f6-4d0e-be6c-8aefd3d93e8d';
const correctProPlanId = '40e983d3-2551-466b-8e70-6e72258b5069';

async function fix() {
  console.log(`Updating detective ${detectiveId} to pro plan ${correctProPlanId}...`);
  
  await db.update(detectives)
    .set({ subscriptionPackageId: correctProPlanId })
    .where(eq(detectives.id, detectiveId));
  
  console.log('✅ Updated successfully!');
  
  // Verify
  const [detective] = await db.select().from(detectives).where(eq(detectives.id, detectiveId));
  console.log(`\nVerification:`);
  console.log(`Business: ${detective.businessName}`);
  console.log(`New Package ID: ${detective.subscriptionPackageId}`);
  
  process.exit(0);
}

fix();
