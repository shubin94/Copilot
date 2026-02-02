import { readFileSync } from "node:fs";
import { pool } from "../db/index.ts";

function extractEmailTemplatesInsert(sqlText: string): string | null {
  const marker = 'INSERT INTO "public"."email_templates"';
  const start = sqlText.indexOf(marker);
  if (start === -1) return null;

  const rest = sqlText.slice(start);
  const end = rest.indexOf(";");
  if (end === -1) return null;

  return rest.slice(0, end + 1);
}

async function seedEmailTemplates() {
  try {
    const sqlText = readFileSync("supabase/seed.sql", "utf8");
    const insertSql = extractEmailTemplatesInsert(sqlText);

    if (!insertSql) {
      console.error("❌ Could not find email_templates INSERT in supabase/seed.sql");
      process.exit(1);
    }

    // Run insert (idempotent if table empty; may conflict if rows already exist)
    await pool.query("BEGIN");
    await pool.query(insertSql);
    await pool.query("COMMIT");

    console.log("✅ Seeded email_templates from supabase/seed.sql");
    process.exit(0);
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => undefined);
    console.error("❌ Failed to seed email_templates:", (error as Error).message);
    process.exit(1);
  }
}

seedEmailTemplates();
