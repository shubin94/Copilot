import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { services } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function main() {
  const premarriageServices = await db
    .select({
      id: services.id,
      title: services.title,
      images: services.images,
    })
    .from(services)
    .where(eq(services.category, "Pre-marriage investigations"));

  console.log("Pre-marriage Services Images Check:");
  premarriageServices.forEach(s => {
    console.log(`  Service: ${s.title}`);
    console.log(`    Images: ${JSON.stringify(s.images)}`);
    console.log(`    Has images: ${s.images && s.images.length > 0}`);
  });

  process.exit(0);
}

main().catch(console.error);
