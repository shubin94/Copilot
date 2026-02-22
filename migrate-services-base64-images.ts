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
    case "image/png": return "png";
    case "image/jpeg":
    case "image/jpg": return "jpg";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "image/svg+xml": return "svg";
    default: return "bin";
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL!;
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const dryRun = process.env.DRY_RUN === "1";

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const supabase = createClient(supabaseUrl, supabaseKey);

  let totalProcessed = 0;
  let totalUploaded = 0;
  let totalFailed = 0;

  try {
    const result = await pool.query(`
      SELECT id, images
      FROM services
      WHERE images::text LIKE '%data:image%'
    `);

    const rows = result.rows as Array<{
      id: string;
      images: string[] | null;
    }>;

    console.log("Found services:", rows.length);

    for (const row of rows) {
      if (!row.images || row.images.length === 0) continue;

      totalProcessed++;

      const newImages: string[] = [];

      for (let i = 0; i < row.images.length; i++) {
        const img = row.images[i];

        if (!img.startsWith("data:image")) {
          newImages.push(img);
          continue;
        }

        const parsed = parseDataUrl(img);
        if (!parsed) {
          totalFailed++;
          newImages.push(img);
          continue;
        }

        if (dryRun) {
          console.log("[dry-run] would upload", row.id);
          newImages.push(img);
          continue;
        }

        try {
          const ext = extensionForMime(parsed.mime);
          const path = `services/${row.id}-${i}.${ext}`;
          const buffer = Buffer.from(parsed.base64, "base64");

          const upload = await supabase.storage
            .from("service-images")
            .upload(path, buffer, { contentType: parsed.mime, upsert: true });

          if (upload.error) {
            totalFailed++;
            newImages.push(img);
            continue;
          }

          const publicUrl = supabase
            .storage
            .from("service-images")
            .getPublicUrl(path).data.publicUrl;

          newImages.push(publicUrl);
          totalUploaded++;
        } catch (err) {
          totalFailed++;
          newImages.push(img);
        }
      }

      if (!dryRun) {
        await pool.query(
  "UPDATE services SET images = $1 WHERE id = $2",
  [newImages, row.id]
);
        console.log("[updated service]", row.id);
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

main();