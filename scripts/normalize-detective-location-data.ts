import "dotenv/config";
import { pool } from "../db/index.ts";
import { getCountryCode } from "../server/utils/countryCodeMapper.ts";

type DetectiveRow = {
  id: string;
  business_name: string | null;
  slug: string | null;
  country: string;
  state: string;
  city: string;
};

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toTitleFromSlug(value: string): string {
  return value
    .toLowerCase()
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeCountry(rawCountry: string): string {
  const trimmed = normalizeWhitespace(String(rawCountry || ""));
  if (!trimmed) return trimmed;

  if (/^[a-z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const asTitle = trimmed.includes("-") || trimmed.includes("_")
    ? toTitleFromSlug(trimmed)
    : trimmed;

  const code = getCountryCode(asTitle) || getCountryCode(trimmed);
  return code || trimmed;
}

function normalizeLocation(rawValue: string): string {
  const trimmed = normalizeWhitespace(String(rawValue || ""));
  if (!trimmed) return trimmed;

  const hasOnlySlugChars = /^[a-z0-9-_]+$/i.test(trimmed);
  const looksSlugLike = hasOnlySlugChars && (trimmed.includes("-") || trimmed.includes("_"));

  if (looksSlugLike) {
    return toTitleFromSlug(trimmed);
  }

  return trimmed;
}

async function createUniqueSlug(base: string, detectiveId: string): Promise<string> {
  const normalizedBase = slugify(base || "detective") || "detective";

  let candidate = normalizedBase;
  let suffix = 1;

  while (true) {
    const existing = await pool.query(
      "SELECT id FROM detectives WHERE slug = $1 AND id <> $2 LIMIT 1",
      [candidate, detectiveId]
    );

    if (existing.rowCount === 0) {
      return candidate;
    }

    suffix += 1;
    candidate = `${normalizedBase}-${suffix}`;
  }
}

async function normalizeDetectives(options: { apply: boolean; slugFilter?: string }) {
  const { apply, slugFilter } = options;

  const whereClause = slugFilter
    ? "WHERE slug = $1 OR business_name ILIKE $2"
    : "";

  const params = slugFilter ? [slugFilter, `%${slugFilter}%`] : [];

  const query = `
    SELECT id, business_name, slug, country, state, city
    FROM detectives
    ${whereClause}
    ORDER BY created_at DESC
  `;

  const result = await pool.query<DetectiveRow>(query, params);

  console.log(`Found ${result.rowCount ?? 0} detective row(s) to evaluate`);

  let changedCount = 0;

  for (const row of result.rows) {
    const nextCountry = normalizeCountry(row.country);
    const nextState = normalizeLocation(row.state);
    const nextCity = normalizeLocation(row.city);
    const nextSlug = row.slug && row.slug.trim().length > 0
      ? row.slug
      : await createUniqueSlug(row.business_name || "detective", row.id);

    const changes: Record<string, string> = {};

    if (nextCountry !== row.country) changes.country = nextCountry;
    if (nextState !== row.state) changes.state = nextState;
    if (nextCity !== row.city) changes.city = nextCity;
    if (nextSlug !== row.slug) changes.slug = nextSlug;

    if (Object.keys(changes).length === 0) {
      continue;
    }

    changedCount += 1;

    console.log(`\n[${row.id}] ${row.business_name || "(no-name)"}`);
    console.log("  before:", {
      country: row.country,
      state: row.state,
      city: row.city,
      slug: row.slug,
    });
    console.log("  after :", {
      country: changes.country ?? row.country,
      state: changes.state ?? row.state,
      city: changes.city ?? row.city,
      slug: changes.slug ?? row.slug,
    });

    if (apply) {
      await pool.query(
        `
          UPDATE detectives
          SET
            country = $1,
            state = $2,
            city = $3,
            slug = $4,
            updated_at = NOW()
          WHERE id = $5
        `,
        [
          changes.country ?? row.country,
          changes.state ?? row.state,
          changes.city ?? row.city,
          changes.slug ?? row.slug,
          row.id,
        ]
      );
    }
  }

  console.log(`\n${apply ? "Applied" : "Detected"} ${changedCount} row(s) with updates.`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  const slugIndex = args.findIndex((arg) => arg === "--slug");
  const slugFilter = slugIndex >= 0 ? args[slugIndex + 1] : undefined;

  if (slugIndex >= 0 && !slugFilter) {
    throw new Error("Missing value for --slug");
  }

  console.log(apply ? "Running in APPLY mode" : "Running in DRY-RUN mode");
  if (slugFilter) {
    console.log(`Filtering by slug/business_name: ${slugFilter}`);
  }

  await normalizeDetectives({ apply, slugFilter });
}

main()
  .catch((error) => {
    console.error("Normalization failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
