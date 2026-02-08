import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

const detectiveId = '108db626-e2f6-4d0e-be6c-8aefd3d93e8d';
const correctProPlanId = '40e983d3-2551-466b-8e70-6e72258b5069';

async function fix() {
  console.log(`Updating detective ${detectiveId} to pro plan ${correctProPlanId}...`);
  
  const result = await db.update(detectives)
    .set({ subscriptionPackageId: correctProPlanId })
    .where(eq(detectives.id, detectiveId));
  
  // Check that at least one row was updated
  const affectedRows = (result as any).rowCount || (result as any).affectedRows || 0;
  if (affectedRows === 0) {
    console.error(`❌ No rows were updated. Detective ${detectiveId} may not exist.`);
    process.exit(1);
  }
  
  console.log(`✅ Updated ${affectedRows} row(s) successfully!`);
  
  // Verify
  const [detective] = await db.select().from(detectives).where(eq(detectives.id, detectiveId));
  if (!detective) {
    throw new Error(`Detective not found after update: ${detectiveId}`);
  }
  console.log(`\nVerification:`);
  console.log(`Business: ${detective.businessName}`);
  console.log(`New Package ID: ${detective.subscriptionPackageId}`);
  
  process.exit(0);
}

fix();
