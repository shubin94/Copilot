import { db } from "../../db/index.js";
import { sql } from "drizzle-orm";

export type IntegritySeverity = "critical" | "high" | "medium" | "low";

export interface LocationIntegrityIssue {
  code: string;
  severity: IntegritySeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface LocationIntegrityReport {
  checkedAtIso: string;
  ok: boolean;
  hasCritical: boolean;
  issues: LocationIntegrityIssue[];
}

interface RunLocationIntegrityCheckOptions {
  sampleLimit?: number;
  mode?: "full" | "light";
}

function pushIssue(
  issues: LocationIntegrityIssue[],
  severity: IntegritySeverity,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  issues.push({ severity, code, message, details });
}

function severityRank(severity: IntegritySeverity): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function sortIssuesBySeverity(issues: LocationIntegrityIssue[]): LocationIntegrityIssue[] {
  return [...issues].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

interface IntegrityCheckContext {
  sampleLimit: number;
}

type IntegrityCheck = (context: IntegrityCheckContext) => Promise<LocationIntegrityIssue[]>;

async function checkSeoOverrideUpdatedAtColumn(_context: IntegrityCheckContext): Promise<LocationIntegrityIssue[]> {
  const issues: LocationIntegrityIssue[] = [];
  try {
    const updatedAtColumnResult = await db.execute<{ has_updated_at: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'location_seo_overrides'
            AND column_name = 'updated_at'
        ) AS has_updated_at
      `);

    if (!updatedAtColumnResult.rows[0]?.has_updated_at) {
      pushIssue(
        issues,
        "critical",
        "MISSING_LOCATION_SEO_OVERRIDES_UPDATED_AT",
        `Column location_seo_overrides.updated_at is missing; SEO override ordering can break.`,
      );
    }
  } catch (error) {
    pushIssue(
      issues,
      "critical",
      "UPDATED_AT_COLUMN_CHECK_FAILED",
      "Failed while verifying location_seo_overrides.updated_at.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
  return issues;
}

async function checkDuplicateActiveSlugs(context: IntegrityCheckContext): Promise<LocationIntegrityIssue[]> {
  const issues: LocationIntegrityIssue[] = [];
  try {
    const duplicateSlugRows = await db.execute<{
      country_id: number | null;
      state_id: number | null;
      city_id: number | null;
      slug_key: string;
      duplicate_count: number;
      detective_ids: string[];
    }>(sql`
        SELECT
          d.country_id,
          d.state_id,
          d.city_id,
          LOWER(TRIM(d.slug)) AS slug_key,
          COUNT(*)::int AS duplicate_count,
          ARRAY_AGG(d.id::text ORDER BY d.created_at DESC) AS detective_ids
        FROM detectives d
        WHERE d.status = 'active'
          AND d.slug IS NOT NULL
          AND TRIM(d.slug) <> ''
          AND d.country_id IS NOT NULL
          AND d.state_id IS NOT NULL
          AND d.city_id IS NOT NULL
        GROUP BY d.country_id, d.state_id, d.city_id, LOWER(TRIM(d.slug))
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC, slug_key ASC
        LIMIT ${context.sampleLimit}
      `);

    if (duplicateSlugRows.rows.length > 0) {
      pushIssue(
        issues,
        "high",
        "DUPLICATE_ACTIVE_DETECTIVE_SLUGS_PER_LOCATION",
        "Duplicate active detective slugs were found in the same location.",
        {
          sample: duplicateSlugRows.rows,
        },
      );
    }
  } catch (error) {
    pushIssue(
      issues,
      "high",
      "DUPLICATE_SLUG_CHECK_FAILED",
      "Failed while checking duplicate detective slugs per location.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
  return issues;
}

async function checkMissingLocationForeignKeys(context: IntegrityCheckContext): Promise<LocationIntegrityIssue[]> {
  const issues: LocationIntegrityIssue[] = [];
  try {
    const missingFkCountResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int AS count
        FROM detectives d
        WHERE d.status = 'active'
          AND (
            d.country_id IS NULL
            OR d.state_id IS NULL
            OR d.city_id IS NULL
          )
      `);

    const missingFkCount = Number(missingFkCountResult.rows[0]?.count || 0);
    if (missingFkCount > 0) {
      const missingFkSampleResult = await db.execute<{
        id: string;
        business_name: string | null;
        country: string | null;
        state: string | null;
        city: string | null;
        country_id: number | null;
        state_id: number | null;
        city_id: number | null;
      }>(sql`
          SELECT
            d.id,
            d.business_name,
            d.country,
            d.state,
            d.city,
            d.country_id,
            d.state_id,
            d.city_id
          FROM detectives d
          WHERE d.status = 'active'
            AND (
              d.country_id IS NULL
              OR d.state_id IS NULL
              OR d.city_id IS NULL
            )
          ORDER BY d.created_at DESC
          LIMIT ${context.sampleLimit}
        `);

      pushIssue(
        issues,
        "high",
        "ACTIVE_DETECTIVES_MISSING_LOCATION_FKS",
        "Active detectives with missing location foreign keys were found.",
        {
          total: missingFkCount,
          sample: missingFkSampleResult.rows,
        },
      );
    }
  } catch (error) {
    pushIssue(
      issues,
      "high",
      "MISSING_LOCATION_FK_CHECK_FAILED",
      "Failed while checking active detectives with missing location foreign keys.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
  return issues;
}

async function checkOrphanedOrMismatchedLocationForeignKeys(
  context: IntegrityCheckContext,
): Promise<LocationIntegrityIssue[]> {
  const issues: LocationIntegrityIssue[] = [];
  try {
    const orphanCountResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int AS count
        FROM detectives d
        LEFT JOIN countries c ON c.id = d.country_id
        LEFT JOIN states s ON s.id = d.state_id
        LEFT JOIN cities ct ON ct.id = d.city_id
        WHERE d.status = 'active'
          AND (
            (d.country_id IS NOT NULL AND c.id IS NULL)
            OR (d.state_id IS NOT NULL AND s.id IS NULL)
            OR (d.city_id IS NOT NULL AND ct.id IS NULL)
            OR (s.id IS NOT NULL AND c.id IS NOT NULL AND s.country_id <> c.id)
            OR (ct.id IS NOT NULL AND s.id IS NOT NULL AND ct.state_id <> s.id)
          )
      `);

    const orphanCount = Number(orphanCountResult.rows[0]?.count || 0);
    if (orphanCount > 0) {
      const orphanSampleResult = await db.execute<{
        id: string;
        business_name: string | null;
        country_id: number | null;
        state_id: number | null;
        city_id: number | null;
        joined_country_id: number | null;
        joined_state_id: number | null;
        joined_city_id: number | null;
      }>(sql`
          SELECT
            d.id,
            d.business_name,
            d.country_id,
            d.state_id,
            d.city_id,
            c.id AS joined_country_id,
            s.id AS joined_state_id,
            ct.id AS joined_city_id
          FROM detectives d
          LEFT JOIN countries c ON c.id = d.country_id
          LEFT JOIN states s ON s.id = d.state_id
          LEFT JOIN cities ct ON ct.id = d.city_id
          WHERE d.status = 'active'
            AND (
              (d.country_id IS NOT NULL AND c.id IS NULL)
              OR (d.state_id IS NOT NULL AND s.id IS NULL)
              OR (d.city_id IS NOT NULL AND ct.id IS NULL)
              OR (s.id IS NOT NULL AND c.id IS NOT NULL AND s.country_id <> c.id)
              OR (ct.id IS NOT NULL AND s.id IS NOT NULL AND ct.state_id <> s.id)
            )
          ORDER BY d.created_at DESC
          LIMIT ${context.sampleLimit}
        `);

      pushIssue(
        issues,
        "critical",
        "ORPHANED_OR_MISMATCHED_LOCATION_FKS",
        "Active detectives with orphaned or mismatched location foreign keys were found.",
        {
          total: orphanCount,
          sample: orphanSampleResult.rows,
        },
      );
    }
  } catch (error) {
    pushIssue(
      issues,
      "critical",
      "ORPHAN_LOCATION_FK_CHECK_FAILED",
      "Failed while checking orphaned or mismatched location foreign keys.",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
  return issues;
}

async function checkActiveDetectivesMissingSlugLight(
  context: IntegrityCheckContext,
): Promise<LocationIntegrityIssue[]> {
  const issues: LocationIntegrityIssue[] = [];
  try {
    const missingSlugRows = await db.execute<{
      id: string;
      business_name: string | null;
      slug: string | null;
    }>(sql`
      SELECT d.id, d.business_name, d.slug
      FROM detectives d
      WHERE d.status = 'active'
        AND (d.slug IS NULL OR TRIM(d.slug) = '')
      ORDER BY d.created_at DESC
      LIMIT ${context.sampleLimit}
    `);

    if (missingSlugRows.rows.length > 0) {
      pushIssue(
        issues,
        "high",
        "ACTIVE_DETECTIVES_MISSING_SLUG",
        "Active detectives with missing slugs were found.",
        { sample: missingSlugRows.rows },
      );
    }
  } catch (error) {
    pushIssue(
      issues,
      "high",
      "MISSING_SLUG_LIGHT_CHECK_FAILED",
      "Failed while checking active detectives with missing slugs.",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
  return issues;
}

async function checkMissingLocationForeignKeysLight(
  context: IntegrityCheckContext,
): Promise<LocationIntegrityIssue[]> {
  const issues: LocationIntegrityIssue[] = [];
  try {
    const sampleRows = await db.execute<{
      id: string;
      business_name: string | null;
      country_id: number | null;
      state_id: number | null;
      city_id: number | null;
    }>(sql`
      SELECT d.id, d.business_name, d.country_id, d.state_id, d.city_id
      FROM detectives d
      WHERE d.status = 'active'
        AND (
          d.country_id IS NULL
          OR d.state_id IS NULL
          OR d.city_id IS NULL
        )
      ORDER BY d.created_at DESC
      LIMIT ${context.sampleLimit}
    `);

    if (sampleRows.rows.length > 0) {
      pushIssue(
        issues,
        "high",
        "ACTIVE_DETECTIVES_MISSING_LOCATION_FKS_LIGHT",
        "Active detectives with missing location foreign keys were found.",
        { sample: sampleRows.rows },
      );
    }
  } catch (error) {
    pushIssue(
      issues,
      "high",
      "MISSING_LOCATION_FK_LIGHT_CHECK_FAILED",
      "Failed while running light check for missing location foreign keys.",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
  return issues;
}

const INTEGRITY_CHECKS: IntegrityCheck[] = [
  checkSeoOverrideUpdatedAtColumn,
  checkDuplicateActiveSlugs,
  checkMissingLocationForeignKeys,
  checkOrphanedOrMismatchedLocationForeignKeys,
];

const LIGHT_INTEGRITY_CHECKS: IntegrityCheck[] = [
  checkSeoOverrideUpdatedAtColumn,
  checkActiveDetectivesMissingSlugLight,
  checkMissingLocationForeignKeysLight,
];

export async function runLocationIntegrityCheck(
  options: RunLocationIntegrityCheckOptions = {},
): Promise<LocationIntegrityReport> {
  const sampleLimit = typeof options.sampleLimit === "number" && Number.isFinite(options.sampleLimit)
    ? Math.max(1, Math.floor(options.sampleLimit))
    : 5;
  const context: IntegrityCheckContext = { sampleLimit };
  const issues: LocationIntegrityIssue[] = [];
  const checksToRun = options.mode === "light" ? LIGHT_INTEGRITY_CHECKS : INTEGRITY_CHECKS;

  for (const check of checksToRun) {
    const checkIssues = await check(context);
    issues.push(...checkIssues);
  }

  const sortedIssues = sortIssuesBySeverity(issues);
  const hasCritical = sortedIssues.some((issue) => issue.severity === "critical");
  const hasHigh = sortedIssues.some((issue) => issue.severity === "high");

  return {
    checkedAtIso: new Date().toISOString(),
    ok: !hasCritical && !hasHigh,
    hasCritical,
    issues: sortedIssues,
  };
}

export function formatLocationIntegrityReport(report: LocationIntegrityReport): string {
  const header = `[Location Integrity] ${report.ok ? "OK" : "ISSUES FOUND"} at ${report.checkedAtIso}`;
  if (report.issues.length === 0) {
    return `${header}\n- No issues detected`;
  }

  const lines = report.issues.map((issue, index) => {
    const details = issue.details ? ` ${JSON.stringify(issue.details)}` : "";
    return `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}${details}`;
  });

  return [header, ...lines].join("\n");
}
