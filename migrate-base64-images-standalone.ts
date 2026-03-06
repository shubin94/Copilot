import { createClient } from "@supabase/supabase-js";
import pkg from "pg";

const { Pool } = pkg;

const BATCH_SIZE = 10;

type DataUrlParts = {
  mime: string;
  base64: string;
};

function parseDataUrl(value: string): DataUrlParts | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  if (!databaseUrl) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const supabase = createClient(supabaseUrl, supabaseKey);

  let totalProcessed = 0;
  let totalUploaded = 0;
  let totalFailed = 0;

  let lastId: string | null = null;

  try {
    while (true) {
      const params: Array<string> = [];
      let whereClause = "(logo LIKE 'data:image%' OR default_service_banner LIKE 'data:image%')";
      if (lastId) {
        params.push(lastId);
        whereClause += " AND id > $1";
      }

      const query = `
        SELECT id, logo, default_service_banner
        FROM detectives
        WHERE ${whereClause}
        ORDER BY id
        LIMIT ${BATCH_SIZE}
      `;

      const result = await pool.query(query, params);
      const rows = result.rows as Array<{
        id: string;
        logo: string | null;
        default_service_banner: string | null;
      }>;

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        totalProcessed += 1;
        lastId = row.id;

        const updates: { logo?: string; default_service_banner?: string } = {};

        if (row.logo && row.logo.startsWith("data:image")) {
          const parsed = parseDataUrl(row.logo);
          if (!parsed) {
            totalFailed += 1;
            console.error("[logo parse failed]", { id: row.id });
          } else if (dryRun) {
            console.log("[dry-run] would upload logo", { id: row.id, mime: parsed.mime });
          } else {
            try {
              const ext = extensionForMime(parsed.mime);
              const path = `detectives/${row.id}-logo.${ext}`;
              const buffer = Buffer.from(parsed.base64, "base64");
              const upload = await supabase.storage
                .from("detective-assets")
                .upload(path, buffer, { contentType: parsed.mime, upsert: true });
              if (upload.error) {
                totalFailed += 1;
                console.error("[logo upload failed]", { id: row.id, error: upload.error.message });
              } else {
                const publicUrl = supabase.storage.from("detective-assets").getPublicUrl(path).data.publicUrl;
                updates.logo = publicUrl;
                totalUploaded += 1;
              }
            } catch (error) {
              totalFailed += 1;
              console.error("[logo upload error]", { id: row.id, error: String(error) });
            }
          }
        }

        if (row.default_service_banner && row.default_service_banner.startsWith("data:image")) {
          const parsed = parseDataUrl(row.default_service_banner);
          if (!parsed) {
            totalFailed += 1;
            console.error("[banner parse failed]", { id: row.id });
          } else if (dryRun) {
            console.log("[dry-run] would upload banner", { id: row.id, mime: parsed.mime });
          } else {
            try {
              const ext = extensionForMime(parsed.mime);
              const path = `detectives/${row.id}-banner.${ext}`;
              const buffer = Buffer.from(parsed.base64, "base64");
              const upload = await supabase.storage
                .from("detective-assets")
                .upload(path, buffer, { contentType: parsed.mime, upsert: true });
              if (upload.error) {
                totalFailed += 1;
                console.error("[banner upload failed]", { id: row.id, error: upload.error.message });
              } else {
                const publicUrl = supabase.storage.from("detective-assets").getPublicUrl(path).data.publicUrl;
                updates.default_service_banner = publicUrl;
                totalUploaded += 1;
              }
            } catch (error) {
              totalFailed += 1;
              console.error("[banner upload error]", { id: row.id, error: String(error) });
            }
          }
        }

        if (!dryRun && (updates.logo || updates.default_service_banner)) {
          const setClauses: string[] = [];
          const values: Array<string> = [];
          let idx = 1;

          if (updates.logo) {
            setClauses.push(`logo = $${idx++}`);
            values.push(updates.logo);
          }
          if (updates.default_service_banner) {
            setClauses.push(`default_service_banner = $${idx++}`);
            values.push(updates.default_service_banner);
          }

          setClauses.push("updated_at = NOW()");
          values.push(row.id);

          const updateSql = `UPDATE detectives SET ${setClauses.join(", ")} WHERE id = $${idx}`;
          await pool.query(updateSql, values);
          console.log("[updated detective]", row.id);
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
    totalProcessed,
    totalUploaded,
    totalFailed,
    dryRun,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
