import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { services, detectives } from "./shared/schema.ts";
import { eq, sql, isNull, and } from "drizzle-orm";

async function checkMissingImages() {
  console.log("\n🔍 Checking approved services missing images...\n");
  
  try {
    // Services that are active but have NO images
    const missingImages = await db.execute(sql`
      SELECT 
        s.id,
        s.title,
        s.is_active,
        s.images,
        s.created_at,
        d.business_name,
        d.status as detective_status
      FROM services s
      LEFT JOIN detectives d ON s.detective_id = d.id
      WHERE s.is_active = true
      AND (s.images IS NULL OR s.images = ARRAY[]::text[])
      ORDER BY s.created_at DESC
      LIMIT 50
    `);

    const rows = (missingImages as any).rows || [];
    console.log(`📊 Active services WITHOUT images: ${rows.length}\n`);
    
    if (rows.length > 0) {
      console.log("Services missing images:");
      rows.forEach((row: any) => {
        console.log(`  ✗ ${row.title}`);
        console.log(`    ID: ${row.id}`);
        console.log(`    Detective: ${row.business_name} (${row.detective_status})`);
        console.log(`    Created: ${row.created_at}`);
        console.log(`    Images: ${row.images ? JSON.stringify(row.images) : "NULL"}\n`);
      });
    }

    // Check total active services
    const totalActive = await db.execute(sql`
      SELECT COUNT(*) as count FROM services WHERE is_active = true
    `);
    const total = ((totalActive as any).rows[0].count);

    // Check those WITH images
    const withImages = await db.execute(sql`
      SELECT COUNT(*) as count FROM services 
      WHERE is_active = true 
      AND images IS NOT NULL 
      AND images != ARRAY[]::text[]
    `);
    const hasImages = ((withImages as any).rows[0].count);

    console.log(`\n📈 Summary:`);
    console.log(`   Total active services: ${total}`);
    console.log(`   With images: ${hasImages}`);
    console.log(`   Missing images: ${total - hasImages}`);

  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

checkMissingImages();
