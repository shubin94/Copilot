import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function explainAnalyze() {
  try {
    console.log("🔍 Running EXPLAIN ANALYZE on GET /api/services?sortBy=popular\n");
    
    const query = sql.raw(`
      EXPLAIN ANALYZE
      SELECT
        s.id as service_id,
        s.title as service_title,
        s.category as service_category,
        s.base_price as service_base_price,
        s.offer_price as service_offer_price,
        s.is_on_enquiry as service_is_on_enquiry,
        (s.images)[1] as service_main_image,
        s.order_count as service_order_count,
        d.id as detective_id,
        d.business_name as detective_business_name,
        d.level as detective_level,
        d.logo as detective_logo,
        d.country as detective_country,
        d.state as detective_state,
        d.city as detective_city,
        d.slug as detective_slug,
        d.phone as detective_phone,
        d.whatsapp as detective_whatsapp,
        d.contact_email as detective_contact_email,
        d.is_verified as detective_is_verified,
        d.subscription_package_id as detective_subscription_package_id,
        d.subscription_expires_at as detective_subscription_expires_at,
        d.has_blue_tick as detective_has_blue_tick,
        d.blue_tick_addon as detective_blue_tick_addon,
        sp.name as subscription_package_name,
        sp.badges as subscription_package_badges,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count
      FROM services s
      LEFT JOIN detectives d ON s.detective_id = d.id
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      LEFT JOIN reviews r ON s.id = r.service_id AND r.is_published = true
      WHERE s.is_active = true
        AND s.images IS NOT NULL
        AND array_length(s.images, 1) > 0
        AND s.id IN (SELECT service_id FROM popular_service_per_detective)
      GROUP BY s.id, s.title, s.category, s.base_price, s.offer_price, s.is_on_enquiry, s.images, s.order_count,
               d.id, d.business_name, d.level, d.logo, d.country, d.state, d.city, d.slug, d.phone, d.whatsapp, d.contact_email, d.is_verified,
               d.subscription_package_id, d.subscription_expires_at, d.has_blue_tick, d.blue_tick_addon,
               sp.name, sp.badges
      ORDER BY s.order_count DESC
      LIMIT 15 OFFSET 0
    `);
    
    const result = await db.execute(query);
    
    console.log("EXPLAIN ANALYZE OUTPUT:\n");
    console.log("=".repeat(120));
    
    if (result.rows && result.rows.length > 0) {
      for (const row of result.rows as any[]) {
        console.log(row["QUERY PLAN"] || row.plan || Object.values(row)[0]);
      }
    }
    
    console.log("=".repeat(120));
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

explainAnalyze();
