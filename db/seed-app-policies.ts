import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const isLocalDb = url?.includes("localhost") || url?.includes("127.0.0.1");
const sslConfig = !isLocalDb ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({
  connectionString: url,
  ssl: sslConfig
});

const db = drizzle(pool, { schema });

async function seedAppPolicies() {
  try {
    console.log("🔧 Seeding app_policies table...");

    const policies = [
      {
        key: "pagination_default_limit",
        value: { value: 20 },
      },
      {
        key: "pagination_default_offset",
        value: { value: 0 },
      },
      {
        key: "search_default_sort",
        value: { value: "recent" },
      },
      {
        key: "visibility_requirements",
        value: { requireImages: true, requireActiveDetective: true },
      },
      {
        key: "post_approval_status",
        value: { value: "active" },
      },
      {
        key: "pricing_constraints",
        value: { offerLessThanBase: true },
      },
    ];

    for (const policy of policies) {
      await db
        .insert(schema.appPolicies)
        .values({
          key: policy.key,
          value: policy.value,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();

      console.log(`✅ Set ${policy.key}`);
    }

    console.log("\n🎉 All app_policies seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding app_policies:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAppPolicies();
