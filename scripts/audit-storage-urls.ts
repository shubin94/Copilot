import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.ts";

function isSupabasePublicUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });
  const issues: Array<{ table: string; id: string; field: string; value: string }> = [];

  const detectives = await db.select().from(schema.detectives);
  for (const d of detectives) {
    if (typeof (d as any).logo === "string" && (d as any).logo && !isSupabasePublicUrl((d as any).logo)) {
      issues.push({ table: "detectives", id: d.id as any, field: "logo", value: (d as any).logo });
    }
    const bd = (d as any).businessDocuments || [];
    for (const v of bd) {
      if (typeof v === "string" && v && !isSupabasePublicUrl(v)) {
        issues.push({ table: "detectives", id: d.id as any, field: "businessDocuments", value: v });
      }
    }
    const idDocs = (d as any).identityDocuments || [];
    for (const v of idDocs) {
      if (typeof v === "string" && v && !isSupabasePublicUrl(v)) {
        issues.push({ table: "detectives", id: d.id as any, field: "identityDocuments", value: v });
      }
    }
  }

  const services = await db.select().from(schema.services);
  for (const s of services) {
    const imgs = (s as any).images || [];
    for (const v of imgs) {
      if (typeof v === "string" && v && !isSupabasePublicUrl(v)) {
        issues.push({ table: "services", id: s.id as any, field: "images", value: v });
      }
    }
  }

  const settings = await db.select().from(schema.siteSettings);
  for (const set of settings) {
    const u = (set as any).logoUrl;
    if (typeof u === "string" && u && !isSupabasePublicUrl(u)) {
      issues.push({ table: "siteSettings", id: set.id as any, field: "logoUrl", value: u });
    }
  }

  if (issues.length === 0) {
    console.log("Audit: OK. All asset URLs point to Supabase public storage.");
  } else {
    console.log(`Audit: Found ${issues.length} non-Supabase URLs:`);
    for (const i of issues) {
      console.log(`[${i.table}#${i.id}] ${i.field} -> ${i.value}`);
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

