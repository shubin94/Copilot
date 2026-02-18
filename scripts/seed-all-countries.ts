import { Pool } from "pg";
import dotenv from "dotenv";
import { COUNTRY_CODE_MAP } from "../server/utils/countryCodeMapper.ts";

dotenv.config({ path: "./.env.local" });

type CountryRow = {
  name: string;
  code: string;
  slug: string;
};

function toSlug(value: string): string {
  return value
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

  return new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
}

function buildCountryRows(): CountryRow[] {
  return Object.entries(COUNTRY_CODE_MAP)
    .map(([name, code]) => ({
      name,
      code,
      slug: toSlug(name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function upsertCountry(pool: Pool, row: CountryRow): Promise<"inserted" | "updated" | "skipped"> {
  const existing = await pool.query(
    "SELECT id, name, code, slug FROM countries WHERE name = $1 OR code = $2 LIMIT 1",
    [row.name, row.code]
  );

  if (existing.rows.length === 0) {
    await pool.query(
      "INSERT INTO countries (name, slug, iso_code, code, is_active) VALUES ($1, $2, $3, $4, true)",
      [row.name, row.slug, row.code, row.code]
    );
    return "inserted";
  }

  const current = existing.rows[0];
  const needsUpdate = current.code !== row.code || current.slug !== row.slug;

  if (!needsUpdate) {
    return "skipped";
  }

  await pool.query(
    "UPDATE countries SET code = $1, iso_code = $2, slug = $3 WHERE id = $4",
    [row.code, row.code, row.slug, current.id]
  );
  return "updated";
}

async function seedAllCountries(): Promise<void> {
  const pool = createPool();
  const rows = buildCountryRows();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const row of rows) {
      const result = await upsertCountry(pool, row);
      if (result === "inserted") inserted += 1;
      if (result === "updated") updated += 1;
      if (result === "skipped") skipped += 1;
    }

    console.log("\nSeed complete.");
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    const count = await pool.query("SELECT COUNT(*)::int AS count FROM countries");
    console.log(`Total countries: ${count.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

seedAllCountries().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
