import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import { and, gt, or, sql } from "drizzle-orm";
import * as schema from "../shared/schema.ts";
import { ensureBucket, uploadDataUrl } from "../server/supabase.ts";

const { Pool } = pkg;

const BATCH_SIZE = 10;

function isBase64Image(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const db = drizzle(pool, { schema });

  await ensureBucket("detective-assets");

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  let lastId: string | null = null;

  try {
    while (true) {
      const whereClause = lastId
        ? and(
            gt(schema.detectives.id, lastId),
            or(
              sql`logo LIKE 'data:image%'`,
              sql`default_service_banner LIKE 'data:image%'`
            )
          )
        : or(
            sql`logo LIKE 'data:image%'`,
            sql`default_service_banner LIKE 'data:image%'`
          );

      const rows = await db
        .select({
          id: schema.detectives.id,
          logo: schema.detectives.logo,
          defaultServiceBanner: schema.detectives.defaultServiceBanner,
        })
        .from(schema.detectives)
        .where(whereClause)
        .orderBy(schema.detectives.id)
        .limit(BATCH_SIZE);

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        processed++;
        lastId = row.id;

        let nextLogo = row.logo ?? null;
        let nextBanner = row.defaultServiceBanner ?? null;
        let changed = false;

        if (isBase64Image(nextLogo)) {
          try {
            const filename = `logos/${row.id}-logo.png`;
            const uploaded = await uploadDataUrl("detective-assets", filename, nextLogo);
            nextLogo = uploaded;
            changed = true;
          } catch (error) {
            failed++;
            console.error("[logo upload failed]", { id: row.id, error: String(error) });
          }
        } else if (nextLogo) {
          skipped++;
        }

        if (isBase64Image(nextBanner)) {
          try {
            const filename = `banners/${row.id}-default-banner.png`;
            const uploaded = await uploadDataUrl("detective-assets", filename, nextBanner);
            nextBanner = uploaded;
            changed = true;
          } catch (error) {
            failed++;
            console.error("[banner upload failed]", { id: row.id, error: String(error) });
          }
        } else if (nextBanner) {
          skipped++;
        }

        if (changed && !dryRun) {
          await db
            .update(schema.detectives)
            .set({
              logo: nextLogo as any,
              defaultServiceBanner: nextBanner as any,
              updatedAt: new Date(),
            })
            .where(schema.detectives.id.eq(row.id));
          updated++;
          console.log("[updated detective]", row.id);
        } else if (changed && dryRun) {
          console.log("[dry-run] would update", row.id);
        }
      }

      if (rows.length < BATCH_SIZE) {
        break;
      }
    }
  } finally {
    await pool.end();
  }

  console.log("Migration complete", {
    processed,
    updated,
    skipped,
    failed,
    dryRun,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
