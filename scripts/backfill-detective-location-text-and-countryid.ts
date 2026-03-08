import "../server/lib/loadEnv.ts";
import { db, pool } from "../db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Starting detective location backfill...");

  const updateCountryId = await db.execute(sql`
    UPDATE detectives d
    SET country_id = s.country_id
    FROM states s
    WHERE d.state_id = s.id
      AND d.country_id IS NULL
  `);
  console.log("Filled missing country_id from state_id");

  await db.execute(sql`
    UPDATE detectives d
    SET country = c.code
    FROM countries c
    WHERE d.country_id = c.id
      AND (d.country IS DISTINCT FROM c.code)
  `);
  console.log("Normalized detective.country to country code");

  await db.execute(sql`
    UPDATE detectives d
    SET state = s.name
    FROM states s
    WHERE d.state_id = s.id
      AND (d.state IS DISTINCT FROM s.name)
  `);
  console.log("Normalized detective.state to canonical state name");

  await db.execute(sql`
    UPDATE detectives d
    SET city = ci.name
    FROM cities ci
    WHERE d.city_id = ci.id
      AND (d.city IS DISTINCT FROM ci.name)
  `);
  console.log("Normalized detective.city to canonical city name");

  await db.execute(sql`
    UPDATE detectives
    SET location = concat_ws(', ', nullif(city, ''), nullif(state, ''), nullif(country, ''))
    WHERE status = 'active'
  `);
  console.log("Rebuilt detective.location text");

  const summary = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_active,
      COUNT(*) FILTER (WHERE country_id IS NOT NULL)::int AS with_country_id,
      COUNT(*) FILTER (WHERE state_id IS NOT NULL)::int AS with_state_id,
      COUNT(*) FILTER (WHERE city_id IS NOT NULL)::int AS with_city_id
    FROM detectives
    WHERE status='active'
  `);

  console.log("Summary:", summary.rows?.[0]);
}

run()
  .then(async () => {
    await pool.end();
    console.log("Backfill complete");
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
