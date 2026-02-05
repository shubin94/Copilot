import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function checkPlanFeatures() {
  const result = await db.execute(sql`
    SELECT id, name, display_name, features, badges, is_active
    FROM subscription_plans
    ORDER BY name
  `);
  console.log("Subscription plans:");
  for (const row of result.rows as any[]) {
    console.log(`- ${row.name} (${row.display_name}) active=${row.is_active}`);
    console.log(`  features: ${JSON.stringify(row.features)}`);
    console.log(`  badges: ${JSON.stringify(row.badges)}`);
  }
  process.exit(0);
}

checkPlanFeatures();
