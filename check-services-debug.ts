import { db } from "./db/index.ts";
import { services, detectives } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

const rows = await db
  .select({
    id: services.id,
    title: services.title,
    slug: services.slug,
    isActive: services.isActive,
    businessName: detectives.businessName,
    detectiveSlug: detectives.slug,
  })
  .from(services)
  .innerJoin(detectives, eq(services.detectiveId, detectives.id))
  .limit(20);

console.log("Services in DB:");
rows.forEach(row => {
  console.log(`- ${row.title} [slug: ${row.slug}] (active: ${row.isActive}) - by ${row.businessName} [${row.detectiveSlug}]`);
});

process.exit(0);
