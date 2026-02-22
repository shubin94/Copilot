import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function applyMigration() {
  try {
    console.log("🔄 Applying migration: 04-popular-service-per-detective.sql\n");
    
    // Step 1: Drop materialized view if exists
    console.log("⏳ Step 1: Dropping existing materialized view if present...");
    try {
      await db.execute(sql.raw(`DROP MATERIALIZED VIEW IF EXISTS popular_service_per_detective CASCADE`));
      console.log("✅ Drop completed (or view didn't exist)\n");
    } catch (error: any) {
      console.log(`⚠️  Drop skipped: ${error.message}\n`);
    }
    
    // Step 2: Create materialized view
    console.log("⏳ Step 2: Creating materialized view...");
    const createViewSql = `
      CREATE MATERIALIZED VIEW popular_service_per_detective AS
      SELECT DISTINCT ON (s.detective_id)
        s.id AS service_id,
        s.detective_id,
        s.title,
        s.slug,
        s.category,
        s.description,
        s.images,
        s.base_price,
        s.offer_price,
        s.is_on_enquiry,
        s.is_active,
        s.order_count,
        s.view_count,
        s.created_at,
        s.updated_at
      FROM services s
      WHERE s.is_active = true
        AND s.images IS NOT NULL
        AND array_length(s.images, 1) > 0
      ORDER BY s.detective_id, s.order_count DESC, s.updated_at DESC
    `;
    
    await db.execute(sql.raw(createViewSql));
    console.log("✅ Materialized view created\n");
    
    // Step 3: Create indexes
    console.log("⏳ Step 3: Creating indexes...");
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_popular_service_detective_id 
        ON popular_service_per_detective (detective_id)
    `));
    console.log("✅ Index on detective_id created");
    
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_popular_service_order_count 
        ON popular_service_per_detective (order_count DESC)
    `));
    console.log("✅ Index on order_count created\n");
    
    console.log("✅ Migration completed successfully!\n");
    
    // Verify the materialized view
    console.log("🔍 Verification:");
    const countResult = await db.execute(
      sql.raw(`SELECT COUNT(*) as count FROM popular_service_per_detective`)
    );
    console.log(`✅ Materialized view contains ${(countResult.rows[0] as any)?.count || 0} rows`);
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
