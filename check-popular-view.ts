import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { services } from "./shared/schema.ts";
import { eq, sql } from "drizzle-orm";

async function main() {
  // Check if the materialized view exists and what's in it
  try {
    const viewData = await db.execute(sql`SELECT * FROM popular_service_per_detective LIMIT 10`);
    console.log('✅ View exists. Data:', (viewData as any).rows);
  } catch (err: any) {
    console.log('❌ View error:', err.message);
  }

  // Check the specific Pre-marriage services
  const premarriageServices = await db
    .select({ 
      id: services.id,
      title: services.title,
    })
    .from(services)
    .where(eq(services.category, "Pre-marriage investigations"));

  console.log("\nPre-marriage services in database:");
  premarriageServices.forEach(s => {
    console.log(`  - ${s.id}: ${s.title}`);
  });

  process.exit(0);
}

main().catch(console.error);
