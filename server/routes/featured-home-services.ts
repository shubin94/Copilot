import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";
import * as cache from "../lib/cache.ts";

const router = Router();

/**
 * 🚀 Featured Home Services Endpoint
 * Returns exactly 8 services - 1 per detective
 * Optimized with aggressive 5-minute caching
 * Used on home page for fast loading
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const cacheKey = "services:featured:home:8unique";
    
    // Check cache first (5 minute TTL for extremely fast home page loads)
    if (!req.session?.userId) {
      try {
        const cached = cache.get<{ services: unknown[] }>(cacheKey);
        if (cached != null && Array.isArray(cached.services) && cached.services.length === 8) {
          console.log("[HOME CACHE HIT] 8 featured services returned from cache");
          res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
          res.json(cached);
          return;
        }
      } catch (_) {
        // Cache failure must not break the request
      }
    }

    console.log("[HOME CACHE MISS] Fetching 8 featured services from database");

    // Get top 8 services - exactly 1 per detective
    // Ordered by visibility score (best detectives first)
    // Only services with images are shown
    const result = await pool.query(`
      WITH ranked_services AS (
        SELECT 
          s.id,
          s.detective_id,
          s.title,
          s.category,
          s.description,
          s.images,
          s.base_price,
          s.offer_price,
          s.is_on_enquiry,
          s.order_count,
          s.updated_at,
          ROW_NUMBER() OVER (PARTITION BY s.detective_id ORDER BY s.order_count DESC, s.updated_at DESC) as rn
        FROM services s
        WHERE s.is_active = true
          AND s.images IS NOT NULL 
          AND s.images::text[] != '{}'::text[]
      ),
      unique_detective_services AS (
        SELECT * FROM ranked_services WHERE rn = 1
      )
      SELECT 
        us.id,
        us.detective_id,
        us.title,
        us.category,
        us.description,
        us.images,
        us.base_price,
        us.offer_price,
        us.is_on_enquiry,
        us.order_count,
        us.updated_at,
        (SELECT AVG(rating) FROM reviews WHERE service_id = us.id) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE service_id = us.id) as review_count,
        d.id as detective_id_check,
        d.user_id,
        d.business_name,
        d.bio,
        d.logo,
        d.location,
        d.country,
        d.state,
        d.city,
        d.phone,
        d.whatsapp,
        d.contact_email,
        d.status,
        d.is_verified,
        d.level,
        dv.visibility_score,
        dv.is_featured,
        u.email
      FROM unique_detective_services us
      JOIN detectives d ON us.detective_id = d.id
      LEFT JOIN detective_visibility dv ON d.id = dv.detective_id
      JOIN users u ON d.user_id = u.id
      WHERE d.status = 'active'
      ORDER BY dv.visibility_score DESC NULLS LAST, us.order_count DESC
      LIMIT 8
    `);

    // Map database rows to service objects
    const services = await Promise.all(result.rows.map(async (row: any) => {
      const service = {
        id: row.id,
        detectiveId: row.detective_id,
        title: row.title,
        category: row.category,
        description: row.description,
        images: Array.isArray(row.images) ? row.images : (row.images ? [row.images] : []),
        basePrice: row.base_price,
        offerPrice: row.offer_price,
        isOnEnquiry: row.is_on_enquiry,
        orderCount: row.order_count,
        isActive: true,
        avgRating: row.avg_rating ? parseFloat(row.avg_rating) : 0,
        reviewCount: row.review_count ? parseInt(row.review_count) : 0,
        detective: {
          id: row.detective_id_check,
          userId: row.user_id,
          businessName: row.business_name,
          bio: row.bio,
          logo: row.logo,
          location: row.location || "Not specified",
          country: row.country,
          state: row.state,
          city: row.city,
          phone: row.phone,
          whatsapp: row.whatsapp,
          contactEmail: row.contact_email,
          email: row.email,
          status: row.status,
          isVerified: row.is_verified,
          level: row.level,
          visibilityScore: row.visibility_score || 0,
          isFeatured: row.is_featured || false,
        }
      };

      // Return service with detective data
      // Note: Contact masking is handled by the main routes.ts endpoint
      // This endpoint returns public detective data for featured services
      return { 
        ...service, 
        detective: service.detective
      };
    }));

    // Cache for 5 minutes (aggressive caching for home page performance)
    if (!req.session?.userId) {
      try {
        cache.set(cacheKey, { services }, 300);
      } catch (_) {
        // Cache failure must not break the request
      }
    }

    console.log(`[HOME PAGE] Loaded ${services.length} featured services (1 per detective) with ${services.reduce((sum, s) => sum + (s.images?.length || 0), 0)} images total`);
    
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json({ services });
  } catch (error) {
    console.error("[Featured Home Services] Error:", error);
    res.status(500).json({ error: "Failed to load featured services" });
  }
});

export default router;
