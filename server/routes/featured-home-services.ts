import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";
import * as cache from "../lib/cache.ts";

const router = Router();

const featuredHomeCache = {
  key: "featured_home",
  data: null as { services: unknown[] } | null,
  expiresAt: 0
};

/**
 * 🚀 Featured Home Services Endpoint
 * Returns exactly 8 services - 1 per detective
 * Optimized with aggressive 5-minute caching
 * Used on home page for fast loading
 * 
 * Query Parameters:
 * - country: Optional country code to filter by
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    // Performance: Total route execution timing
    const routeStartTime = Date.now();
    console.time("[PERF:HOME] Total route execution");

    // Extract country parameter from query string
    const country = req.query.country ? String(req.query.country).toUpperCase() : undefined;
    
    // Build cache key including country parameter
    const cacheKey = country 
      ? `services:featured:home:8unique:${country}`
      : "services:featured:home:8unique";

    const now = Date.now();
    if (featuredHomeCache.data && now < featuredHomeCache.expiresAt) {
      console.timeEnd("[PERF:HOME] Total route execution");
      res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      res.json(featuredHomeCache.data);
      return;
    }
    
    // Check cache first (5 minute TTL for extremely fast home page loads)
    if (!req.session?.userId) {
      try {
        const cached = cache.get<{ services: unknown[] }>(cacheKey);
        if (cached != null && Array.isArray(cached.services) && cached.services.length === 8) {
          const cacheTime = Date.now() - routeStartTime;
          console.log("[HOME CACHE HIT] 8 featured services returned from cache in", cacheTime, "ms");
          console.timeEnd("[PERF:HOME] Total route execution");
          res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
          res.json(cached);
          return;
        }
      } catch (_) {
        // Cache failure must not break the request
      }
    }

    console.log("[HOME CACHE MISS] Fetching 8 featured services from database");

    // Performance: Database query execution timing
    console.time("[PERF:HOME] Database query execution");
    const queryStartTime = Date.now();

    // Build WHERE clause with optional country filter
    const countryFilter = country ? `AND d.country = '${country}'` : '';

    // SQL query template for featured services
    const buildQuery = (filterClause: string) => `
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
        AVG(r.rating)::numeric as avg_rating,
        COUNT(r.id) as review_count,
        d.detective_id_value as detective_id_check,
        d.user_id,
        d.business_name,
        d.bio,
        d.logo,
        d.location,
        d.slug,
        d.country,
        d.state,
        d.city,
        d.phone,
        d.whatsapp,
        d.contact_email,
        d.status,
        d.is_verified,
        d.level,
        d.visibility_score,
        d.is_featured,
        u.email
      FROM (
        SELECT d.id as detective_id_value, d.user_id, d.business_name, d.bio, d.logo, d.location, d.slug, 
               d.country, d.state, d.city, d.phone, d.whatsapp, d.contact_email, 
               d.status, d.is_verified, d.level,
               COALESCE(dv.visibility_score, 0) as visibility_score, 
               COALESCE(dv.is_featured, false) as is_featured
        FROM detectives d
        LEFT JOIN detective_visibility dv ON d.id = dv.detective_id
        WHERE d.status = 'active'
        ${filterClause}
        ORDER BY visibility_score DESC NULLS LAST
        LIMIT 8
      ) d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT s.id, s.detective_id, s.title, s.category, s.description, s.images,
               s.base_price, s.offer_price, s.is_on_enquiry, s.order_count, s.updated_at
        FROM services s
        WHERE s.detective_id = d.detective_id_value
          AND s.is_active = true
          AND s.images IS NOT NULL
          AND s.images::text[] != '{}'::text[]
        ORDER BY s.order_count DESC, s.updated_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN reviews r ON s.id = r.service_id
      GROUP BY 
        s.id, s.detective_id, s.title, s.category, s.description, s.images,
        s.base_price, s.offer_price, s.is_on_enquiry, s.order_count, s.updated_at,
        d.detective_id_value, d.user_id, d.business_name, d.bio, d.logo, d.location, d.slug,
        d.country, d.state, d.city, d.phone, d.whatsapp, d.contact_email, d.status,
        d.is_verified, d.level, d.visibility_score, d.is_featured, u.email
    `;

    // Get top 8 services - exactly 1 per detective
    // Ordered by visibility score (best detectives first)
    // Only services with images are shown
    // Optimized: Uses LATERAL join for sequential per-detective service selection (no window functions)
    let result = await pool.query(buildQuery(countryFilter));
    let usedFallback = false;

    // ✅ FALLBACK: If country filter provided but no results, try global results
    if (result.rows.length === 0 && country && String(country).trim()) {
      console.log(`[FALLBACK] No services for country=${country}, retrying with global results`);
      usedFallback = true;
      const fallbackStartTime = Date.now();
      result = await pool.query(buildQuery(''));  // Empty filter clause for global
      const fallbackTime = Date.now() - fallbackStartTime;
      console.log(`[FALLBACK] Global query returned ${result.rows.length} rows in ${fallbackTime}ms`);
    }

    // Performance: Log query execution time
    const queryTime = Date.now() - queryStartTime;
    console.timeEnd("[PERF:HOME] Database query execution");
    console.log(`[PERF:HOME] Query returned ${result.rows.length} rows in ${queryTime}ms`);

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
          slug: row.slug,
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

    featuredHomeCache.data = { services };
    featuredHomeCache.expiresAt = Date.now() + 60_000;

    // Cache for 5 minutes (aggressive caching for home page performance)
    // Only cache if we didn't use fallback (don't pollute country-specific cache with global results)
    if (!req.session?.userId && !usedFallback) {
      try {
        cache.set(cacheKey, { services }, 300);
      } catch (_) {
        // Cache failure must not break the request
      }
    }

    console.log(`[HOME PAGE] Loaded ${services.length} featured services (1 per detective)${country ? ` for ${country}${usedFallback ? ' (global fallback)' : ''}` : ''} with ${services.reduce((sum, s) => sum + (s.images?.length || 0), 0)} images total`);
    
    // Performance: Log total route execution time
    const totalTime = Date.now() - routeStartTime;
    console.timeEnd("[PERF:HOME] Total route execution");
    console.log(`[PERF:HOME] Total route time: ${totalTime}ms (Query: ${queryTime}ms, Mapping+Cache: ${totalTime - queryTime}ms)`);
    
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json({ services });
  } catch (error) {
    console.timeEnd("[PERF:HOME] Total route execution");
    console.error("[Featured Home Services] Error:", error);
    res.status(500).json({ error: "Failed to load featured services" });
  }
});

export default router;
