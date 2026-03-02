import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { services, detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function main() {
  const premarriageServices = await db
    .select({
      serviceId: services.id,
      serviceTitle: services.title,
      serviceActive: services.isActive,
      detectiveId: detectives.id,
      detectiveName: detectives.businessName,
      detectiveStatus: detectives.status,
    })
    .from(services)
    .innerJoin(detectives, eq(services.detectiveId, detectives.id))
    .where(eq(services.category, "Pre-marriage investigations"));

  console.log("Services and their Detectives:");
  premarriageServices.forEach(s => {
    console.log(`  Service: ${s.serviceTitle} (active: ${s.serviceActive})`);
    console.log(`    Detective: ${s.detectiveName} (status: ${s.detectiveStatus})`);
  });

  process.exit(0);
}

main().catch(console.error);
