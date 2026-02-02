import { db } from "./db/index.ts";
import { detectives } from "./shared/schema.ts";

async function checkDetectives() {
  const allDetectives = await db.select({
    id: detectives.id,
    businessName: detectives.businessName,
    status: detectives.status,
    city: detectives.city,
  }).from(detectives);
  
  console.log(`Total detectives in DB: ${allDetectives.length}`);
  console.log("\nAll detectives:");
  allDetectives.forEach((d, i) => {
    console.log(`${i + 1}. ${d.businessName} - Status: ${d.status} - City: ${d.city}`);
  });
  
  process.exit(0);
}

checkDetectives();
