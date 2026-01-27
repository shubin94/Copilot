import { drizzle as drizzleSrc } from "drizzle-orm/node-postgres";
import { drizzle as drizzleDest } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function copyTable<T extends keyof typeof schema>(src: any, dest: any, tableName: T) {
  const table = (schema as any)[tableName];
  const rows = await src.select().from(table);
  for (const r of rows) {
    try {
      await dest.insert(table).values(r as any);
    } catch (e: any) {
      const idCol = (table as any).id;
      if (idCol && (e?.message || "").toLowerCase().includes("duplicate")) {
        await dest.update(table).set(r as any).where(eq(idCol, (r as any).id));
      }
    }
  }
}

async function main() {
  const SRC = process.env.SRC_DATABASE_URL!;
  const DEST = process.env.DEST_DATABASE_URL!;
  if (!SRC || !DEST) {
    console.error("Missing SRC_DATABASE_URL or DEST_DATABASE_URL");
    process.exit(1);
  }
  const srcPool = new Pool({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  const destPool = new Pool({ connectionString: DEST, ssl: { rejectUnauthorized: false } });
  const src = drizzleSrc(srcPool, { schema });
  const dest = drizzleDest(destPool, { schema });

  await copyTable(src, dest, "users");
  await copyTable(src, dest, "serviceCategories");
  await copyTable(src, dest, "detectives");
  await copyTable(src, dest, "services");
  await copyTable(src, dest, "reviews");
  await copyTable(src, dest, "orders");
  await copyTable(src, dest, "favorites");
  await copyTable(src, dest, "detectiveApplications");
  await copyTable(src, dest, "profileClaims");
  await copyTable(src, dest, "billingHistory");
  await copyTable(src, dest, "siteSettings");
  await copyTable(src, dest, "searchStats");

  await srcPool.end();
  await destPool.end();
  console.log("Database copy complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
