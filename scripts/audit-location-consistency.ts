import "../server/lib/loadEnv.ts";
import { db, pool } from "../db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  console.log("\n=== LOCATION CONSISTENCY AUDIT ===\n");

  const activeTotal = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM detectives WHERE status = 'active'
  `);
  console.log("Active detectives:", activeTotal.rows?.[0]?.count ?? 0);

  const fkCoverage = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE country_id IS NOT NULL)::int AS with_country_id,
      COUNT(*) FILTER (WHERE state_id IS NOT NULL)::int AS with_state_id,
      COUNT(*) FILTER (WHERE city_id IS NOT NULL)::int AS with_city_id,
      COUNT(*)::int AS total
    FROM detectives
    WHERE status = 'active'
  `);
  console.log("FK coverage:", fkCoverage.rows?.[0]);

  const countryByFk = await db.execute(sql`
    SELECT c.name, c.slug, COUNT(d.id)::int AS detectives
    FROM detectives d
    JOIN countries c ON c.id = d.country_id
    WHERE d.status='active'
    GROUP BY c.id, c.name, c.slug
    ORDER BY detectives DESC, c.name
  `);
  console.log("\nCountry counts by FK:");
  console.table(countryByFk.rows ?? []);

  const countryByText = await db.execute(sql`
    SELECT d.country, COUNT(*)::int AS detectives
    FROM detectives d
    WHERE d.status='active'
    GROUP BY d.country
    ORDER BY detectives DESC, d.country
  `);
  console.log("Country counts by text:");
  console.table(countryByText.rows ?? []);

  const stateByFk = await db.execute(sql`
    SELECT c.slug AS country_slug, s.name AS state_name, s.slug AS state_slug, COUNT(d.id)::int AS detectives
    FROM detectives d
    JOIN states s ON s.id = d.state_id
    JOIN countries c ON c.id = s.country_id
    WHERE d.status='active'
    GROUP BY c.slug, s.name, s.slug
    ORDER BY detectives DESC, c.slug, s.name
  `);
  console.log("State counts by FK:");
  console.table(stateByFk.rows ?? []);

  const cityByFk = await db.execute(sql`
    SELECT c.slug AS country_slug, s.slug AS state_slug, ci.name AS city_name, ci.slug AS city_slug, COUNT(d.id)::int AS detectives
    FROM detectives d
    JOIN cities ci ON ci.id = d.city_id
    JOIN states s ON s.id = ci.state_id
    JOIN countries c ON c.id = s.country_id
    WHERE d.status='active'
    GROUP BY c.slug, s.slug, ci.name, ci.slug
    ORDER BY detectives DESC, c.slug, s.slug, ci.name
  `);
  console.log("City counts by FK:");
  console.table(cityByFk.rows ?? []);

  const suspectRows = await db.execute(sql`
    SELECT id, business_name, country, state, city, country_id, state_id, city_id
    FROM detectives
    WHERE status='active'
      AND (
        country_id IS NULL OR state_id IS NULL OR city_id IS NULL
      )
    ORDER BY business_name NULLS LAST
  `);

  if ((suspectRows.rows?.length ?? 0) > 0) {
    console.log("\nDetectives with missing IDs:");
    console.table(suspectRows.rows ?? []);
  }

  const mismatchRows = await db.execute(sql`
    SELECT d.id, d.business_name, d.country AS detective_country, c.name AS fk_country_name, c.code AS fk_country_code,
           d.state AS detective_state, s.name AS fk_state_name,
           d.city AS detective_city, ci.name AS fk_city_name
    FROM detectives d
    LEFT JOIN countries c ON c.id = d.country_id
    LEFT JOIN states s ON s.id = d.state_id
    LEFT JOIN cities ci ON ci.id = d.city_id
    WHERE d.status='active'
      AND (
        (d.country IS NOT NULL AND c.id IS NOT NULL AND lower(trim(d.country)) NOT IN (lower(trim(c.name)), lower(trim(c.code)), lower(trim(c.slug))))
        OR (d.state IS NOT NULL AND s.id IS NOT NULL AND lower(trim(d.state)) <> lower(trim(s.name)))
        OR (d.city IS NOT NULL AND ci.id IS NOT NULL AND lower(trim(d.city)) <> lower(trim(ci.name)))
      )
  `);

  if ((mismatchRows.rows?.length ?? 0) > 0) {
    console.log("\nDetectives with text-vs-FK mismatch:");
    console.table(mismatchRows.rows ?? []);
  }

  await pool.end();
}

run().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
