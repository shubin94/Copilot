import "../server/lib/loadEnv.ts";
import { db, pool } from "../db/index.ts";
import { detectives } from "../shared/schema.ts";
import { and, eq, isNull, or } from "drizzle-orm";
import { resolveLocationIds } from "../server/services/locationService.ts";

async function backfillMissingLocationIds() {
  const rows = await db
    .select({
      id: detectives.id,
      country: detectives.country,
      state: detectives.state,
      city: detectives.city,
      countryId: detectives.countryId,
      stateId: detectives.stateId,
      cityId: detectives.cityId,
    })
    .from(detectives)
    .where(
      and(
        eq(detectives.status, "active"),
        or(isNull(detectives.stateId), isNull(detectives.cityId))
      )
    );

  console.log(`Found ${rows.length} detectives with missing location IDs`);

  for (const row of rows) {
    const resolved = await resolveLocationIds(
      row.country || "US",
      row.state || "Not specified",
      row.city || "Not specified"
    );

    await db
      .update(detectives)
      .set({
        countryId: resolved.countryId!,
        stateId: resolved.stateId!,
        cityId: resolved.cityId!,
      })
      .where(eq(detectives.id, row.id));

    console.log(
      `Updated detective ${row.id}: countryId=${resolved.countryId}, stateId=${resolved.stateId}, cityId=${resolved.cityId}`
    );
  }
}

backfillMissingLocationIds()
  .then(async () => {
    await pool.end();
    console.log("Backfill complete");
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
