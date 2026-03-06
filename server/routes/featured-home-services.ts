import { Router, Request, Response } from "express";
import { pool } from "../../db/index.js";
import * as cache from "../lib/cache.js";
import { buildServiceCardDTO } from "../../utils/buildServiceCardDTO.js";

const router = Router();

/**
 * 🚀 Featured Home Services Endpoint
 * Returns exactly 8 services - 1 per detective
 * Optimized with in-memory caching (60-second TTL)
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
    const country = req.query.country ? String(req.query.country) : undefined;

    const cacheKey = country ? `featured_home:${country}` : "featured_home:GLOBAL";
    
    // ✅ IN-MEMORY CACHE: Check cache first (60-second TTL, public requests only)
    if (!(req as any).session?.userId) {
      const cached = cache.get<{ services: unknown[] }>(cacheKey);
      if (cached != null && Array.isArray(cached.services) && cached.services.length > 0) {
        const cacheTime = Date.now() - routeStartTime;
        console.log("[HOME CACHE HIT] Featured services returned from cache in", cacheTime, "ms");
        console.timeEnd("[PERF:HOME] Total route execution");
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
        res.json(cached);
        return;
      }
    }

    console.log("[HOME CACHE MISS] Fetching featured services from database");

    // Performance: Database query execution timing
    console.time("[PERF:HOME] Database query execution");
    const queryStartTime = Date.now();

    // Resolve country slug/name to country_id (FK-based filtering)
    let countryId: number | null = null;
    if (country) {
      const countryLookup = await pool.query(
        `SELECT id FROM countries WHERE slug = $1 OR LOWER(name) = LOWER($2) OR code = $3 LIMIT 1`,
        [country.toLowerCase(), country, country.toUpperCase()]
      );
      if (countryLookup.rows.length > 0) {
        countryId = countryLookup.rows[0].id;
        console.log(`[HOME] Resolved country "${country}" to country_id=${countryId}`);
      } else {
        console.log(`[HOME] Country "${country}" not found in normalized table, will use text fallback`);
      }
    }

    // Build WHERE clause with FK-based filtering (fallback to text if country_id not found)
    const countryFilter = country 
      ? (countryId ? 'AND d.country_id = $1' : 'AND d.country = $1')
      : '';
    const countryParam = country ? (countryId || country.toUpperCase()) : null;

    // SQL query template for featured services
    const buildQuery = (filterClause: string, params: (number | string)[] = []) => ({
      text: `
      SELECT 
        s.id,
        s.slug AS service_slug,
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
         u.email,
        sp.name AS subscription_name,
        sp.badges AS subscription_badges,
        sp.features AS subscription_features
      FROM (
        SELECT d.id as detective_id_value, d.user_id, d.business_name, d.bio, d.logo, d.location, d.slug, 
               d.country, d.state, d.city, d.phone, d.whatsapp, d.contact_email, 
           d.status, d.is_verified, d.level, d.subscription_package_id,
               COALESCE(dv.visibility_score, 0) as visibility_score, 
               COALESCE(dv.is_featured, false) as is_featured
        FROM detectives d
        LEFT JOIN detective_visibility dv ON d.id = dv.detective_id
        WHERE d.status = 'active'
        ${filterClause}
          AND EXISTS (
            SELECT 1
            FROM services s
            WHERE s.detective_id = d.id
              AND s.is_active = true
              AND s.images IS NOT NULL
              AND s.images::text[] != '{}'::text[]
          )
        ORDER BY visibility_score DESC NULLS LAST
        LIMIT 8
      ) d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      JOIN LATERAL (
        SELECT s.id, s.slug, s.detective_id, s.title, s.category, s.description, s.images,
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
        s.id, s.slug, s.detective_id, s.title, s.category, s.description, s.images,
        s.base_price, s.offer_price, s.is_on_enquiry, s.order_count, s.updated_at,
        d.detective_id_value, d.user_id, d.business_name, d.bio, d.logo, d.location, d.slug,
        d.country, d.state, d.city, d.phone, d.whatsapp, d.contact_email, d.status,
        d.is_verified, d.level, d.visibility_score, d.is_featured, u.email,
        sp.name, sp.badges, sp.features
    `,
      values: params
    });

    // Get top 8 services - exactly 1 per detective
    // Ordered by visibility score (best detectives first)
    // Only services with images are shown
    // Optimized: Uses LATERAL join for sequential per-detective service selection (no window functions)
    const queryParams = countryParam ? [countryParam] : [];
    let result = await pool.query(buildQuery(countryFilter, queryParams));
    let usedFallback = false;

    // ✅ FALLBACK: If country filter provided but no results, try global results
    if (result.rows.length === 0 && country && String(country).trim()) {
      console.log(`[FALLBACK] No services for country=${country}, retrying with global results`);
      usedFallback = true;
      const fallbackStartTime = Date.now();
      result = await pool.query(buildQuery('', []));  // Empty filter clause for global
      const fallbackTime = Date.now() - fallbackStartTime;
      console.log(`[FALLBACK] Global query returned ${result.rows.length} rows in ${fallbackTime}ms`);
    }

    // Performance: Log query execution time
    const queryTime = Date.now() - queryStartTime;
    console.timeEnd("[PERF:HOME] Database query execution");
    console.log(`[PERF:HOME] Query returned ${result.rows.length} rows in ${queryTime}ms`);

    // Map database rows to service objects
    const rawServices = await Promise.all(result.rows.map(async (row: any) => {
      const service = {
        id: row.id,
        slug: row.service_slug,
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
          subscriptionPackage: {
            name: row.subscription_name,
            badges: row.subscription_badges,
            features: row.subscription_features,
          },
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

    const services = rawServices.map((service: any) =>
      buildServiceCardDTO({
        service,
        detective: service.detective,
        avgRating: service.avgRating ?? null,
        reviewCount: service.reviewCount ?? 0,
        maskContacts: true,
      })
    );

    // ✅ IN-MEMORY CACHE: Store result with 60-second TTL (public requests only)
    // Only cache if we didn't use fallback (to avoid caching incomplete global results)
    if (!(req as any).session?.userId && !usedFallback) {
      try {
        cache.set(cacheKey, { services }, 60);
      } catch (_) {
        // Cache failure must not break the request
      }
    }

    console.log(`[HOME PAGE] Loaded ${services.length} featured services (1 per detective)${country ? ` for ${country}${usedFallback ? ' (global fallback)' : ''}` : ''} with ${services.reduce((sum, s) => sum + (s.images?.length || 0), 0)} images total`);
    
    // Performance: Log total route execution time
    const totalTime = Date.now() - routeStartTime;
    console.timeEnd("[PERF:HOME] Total route execution");
    console.log(`[PERF:HOME] Total route time: ${totalTime}ms (Query: ${queryTime}ms, Mapping+Cache: ${totalTime - queryTime}ms)`);
    
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.json({ services });
  } catch (error) {
    console.timeEnd("[PERF:HOME] Total route execution");
    console.error("[Featured Home Services] Error:", error);
    res.status(500).json({ error: "Failed to load featured services" });
  }
});

export default router;
