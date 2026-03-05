import type { Express, Request, Response } from "express";
import { pool } from "../../db/index";
import { storage } from "../storage";
import { requireAuth, requireRole } from "../authMiddleware";
import * as LocationService from "../services/locationService";

/**
 * Register all location-related routes
 * Includes:
 * - Location hierarchy APIs (countries, states, cities)
 * - Top locations aggregation (public and homepage)
 * - Location management for detectives
 * - Admin SEO overrides for locations
 */
export function registerLocationRoutes(app: Express): void {
  // ========================================
  // PUBLIC LOCATION WIZARD ROUTES
  // ========================================

  /**
   * Get all countries with slugs
   * Used in location wizard during detective profile creation
   * Cached in memory for 24 hours to avoid recomputing library .map()/.sort() operations
   */
  app.get("/api/locations/countries", async (_req: Request, res: Response) => {
    try {
      const allCountries = await LocationService.getAllCountries();
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ countries: allCountries });
    } catch (error) {
      console.error("Get countries error:", error);
      res.status(500).json({ error: "Failed to fetch countries" });
    }
  });

  /**
   * Get states for a specific country
   * Used in location wizard
   * Cached in memory per country to avoid recomputing library .map()/.sort() operations
   */
  app.get("/api/locations/states/:countryId", async (req: Request, res: Response) => {
    try {
      const { countryId } = req.params;
      const countryStates = await LocationService.getStatesForCountry(countryId);
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ states: countryStates });
    } catch (error) {
      console.error("Get states error:", error);
      res.status(500).json({ error: "Failed to fetch states" });
    }
  });

  /**
   * Get cities for a specific state
   * Used in location wizard
   * Cached in memory per state to avoid recomputing library .map()/.sort() operations
   */
  app.get("/api/locations/cities/:stateId", async (req: Request, res: Response) => {
    try {
      const { stateId } = req.params;
      const { countryId } = req.query;
      
      if (!countryId || typeof countryId !== 'string') {
        return res.status(400).json({ error: "Country ID is required" });
      }

      const stateCities = await LocationService.getCitiesForState(countryId, stateId);
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ cities: stateCities });
    } catch (error) {
      console.error("Get cities error:", error);
      res.status(500).json({ error: "Failed to fetch cities" });
    }
  });

  // ========================================
  // PUBLIC TOP LOCATIONS ROUTES
  // ========================================

  /**
   * Get top locations with detective counts
   * Aggregates detectives by country, state, and city using normalized FK references
   * Query params: limitCountries, limitStates, limitCities (defaults: 10 each, max: 50)
   * Cached for 24 hours
   */
  app.get("/api/locations/top", async (req: Request, res: Response) => {
    try {
      const limitCountries = Math.min(Number(req.query.limitCountries) || 10, 50);
      const limitStates = Math.min(Number(req.query.limitStates) || 10, 50);
      const limitCities = Math.min(Number(req.query.limitCities) || 10, 50);

      const { countries: countriesData, states: statesData, cities: citiesData } = 
        await storage.getTopLocations(limitCountries, limitStates, limitCities);

      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ countries: countriesData, states: statesData, cities: citiesData });
    } catch (error) {
      console.error("[API /api/locations/top] Error:", error);
      res.status(500).json({ 
        error: "Failed to fetch top locations",
        countries: [],
        states: [],
        cities: [],
      });
    }
  });

  /**
   * Homepage API - Get top locations for the homepage location grid section
   * Uses location aggregation with homepage-specific limits (8 each)
   * SSR-friendly, cached for performance
   */
  app.get("/api/homepage/top-locations", async (_req: Request, res: Response) => {
    try {
      const { countries: topCountries, states: topStates, cities: topCities } = 
        await storage.getTopLocationsForHomepage();

      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({
        topCountries,
        topStates,
        topCities,
      });
    } catch (error) {
      console.error("[Homepage API] Error fetching top locations:", error);
      res.status(500).json({ 
        error: "Failed to fetch top locations",
        topCountries: [],
        topCities: [],
        topStates: [],
      });
    }
  });

  // ========================================
  // AUTHENTICATED DETECTIVE LOCATION ROUTES
  // ========================================

  /**
   * Update detective location
   * Only the authenticated detective or admin can update their location
   * Validates location hierarchy and auto-generates slugs
   */
  app.patch("/api/detectives/me/location", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      // Verify detective ownership
      const detective = await storage.getDetectiveByUserId(userId);
      if (!detective) {
        return res.status(404).json({ error: "Detective profile not found" });
      }

      // Validate request body
      const { countryId, stateId, cityId } = req.body;
      if (!countryId || !stateId || !cityId) {
        return res.status(400).json({ 
          error: "Invalid location selection",
          details: "countryId, stateId, and cityId are required"
        });
      }

      // Update location (includes validation and auto-slug)
      const updated = await storage.updateDetectiveLocation(detective.id, {
        countryId,
        stateId,
        cityId
      });

      if (!updated) {
        return res.status(500).json({ error: "Failed to update location" });
      }

      res.json({ 
        success: true,
        detective: updated
      });
    } catch (error) {
      console.error("Update detective location error:", error);
      
      // Handle validation errors from storage
      if (error instanceof Error && error.message.includes("Invalid")) {
        return res.status(400).json({ 
          error: "Invalid location selection",
          details: error.message
        });
      }
      
      res.status(500).json({ 
        error: "Failed to update location",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // ADMIN LOCATION SEO ROUTES
  // ========================================

  /**
   * Get countries with SEO metadata for admin management
   * Shows custom SEO overrides and system-generated fallbacks
   */
  app.get("/api/admin/location-seo/countries", requireRole("admin", "employee"), async (_req: Request, res: Response) => {
    try {
      console.log("[Admin Location SEO] Fetching countries...");
      
      const result = await pool.query(`
        SELECT
          c.id,
          c.name,
          c.slug AS country_slug,
          COUNT(d.id) FILTER (WHERE d.status = 'active')::int AS total_detectives,
          COUNT(d.id)::int AS total_all_detectives,
          lso.meta_title,
          lso.meta_description,
          lso.h1,
          (lso.id IS NOT NULL) as has_override,
          lso.updated_at
        FROM countries c
        LEFT JOIN detectives d ON d.country_id = c.id
        LEFT JOIN location_seo_overrides lso
          ON lso.entity_type = 'country'
          AND lso.entity_id = c.id::text
        WHERE c.is_active = true
        GROUP BY
          c.id,
          c.name,
          c.slug,
          lso.meta_title,
          lso.meta_description,
          lso.h1,
          lso.id,
          lso.updated_at
        ORDER BY c.slug ASC
      `);

      // Generate system SEO for rows without overrides
      const enrichedData = result.rows.map(row => {
        const year = new Date().getFullYear();
        return {
          country_slug: row.country_slug,
          total_detectives: row.total_detectives,
          total_all_detectives: row.total_all_detectives,
          custom_title: row.meta_title || `Top Private Detectives in ${row.name} | Verified Investigators (${year})`,
          custom_meta_description: row.meta_description || `Find trusted private detectives in ${row.name}. Browse ${row.total_detectives} verified investigators offering background checks, surveillance, and investigation services.`,
          custom_h1: row.h1 || `Private Detectives in ${row.name}`,
          has_override: row.has_override,
          updated_at: row.updated_at
        };
      });

      console.log(`[Admin Location SEO] Fetched ${enrichedData.length} countries with system-generated fallbacks`);
      res.json({ success: true, data: enrichedData });
    } catch (error: any) {
      console.error("[Admin Location SEO] Countries ERROR:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to fetch country SEO overrides" });
    }
  });

  /**
   * Get states with SEO metadata for admin management
   * Shows custom SEO overrides and system-generated fallbacks
   */
  app.get("/api/admin/location-seo/states", requireRole("admin", "employee"), async (_req: Request, res: Response) => {
    try {
      console.log("[Admin Location SEO] Fetching states...");
      const result = await pool.query(`
        SELECT
          c.name AS country_name,
          c.slug AS country_slug,
          s.name AS state_name,
          s.slug AS state_slug,
          COUNT(d.id) FILTER (WHERE d.status = 'active')::int AS total_detectives,
          lso.meta_title,
          lso.meta_description,
          lso.h1,
          (lso.id IS NOT NULL) as has_override,
          lso.updated_at
        FROM states s
        INNER JOIN countries c ON s.country_id = c.id
        LEFT JOIN detectives d ON d.state_id = s.id
        LEFT JOIN location_seo_overrides lso
          ON lso.entity_type = 'state'
          AND lso.entity_id = s.id::text
        WHERE s.is_active = true
          AND c.is_active = true
        GROUP BY
          c.id,
          c.name,
          c.slug,
          s.id,
          s.name,
          s.slug,
          lso.meta_title,
          lso.meta_description,
          lso.h1,
          lso.id,
          lso.updated_at
        ORDER BY c.slug ASC, s.slug ASC
      `);

      // Generate system SEO for rows without overrides
      const year = new Date().getFullYear();
      const enrichedData = result.rows.map(row => ({
        country_slug: row.country_slug,
        state_slug: row.state_slug,
        total_detectives: row.total_detectives,
        custom_title: row.meta_title || `Top Private Detectives in ${row.state_name}, ${row.country_name} | Verified Investigators (${year})`,
        custom_meta_description: row.meta_description || `Find trusted private detectives in ${row.state_name}, ${row.country_name}. Browse ${row.total_detectives} verified investigators offering background checks, surveillance, and investigation services.`,
        custom_h1: row.h1 || `Private Detectives in ${row.state_name}, ${row.country_name}`,
        has_override: row.has_override,
        updated_at: row.updated_at
      }));

      console.log(`[Admin Location SEO] Fetched ${enrichedData.length} states with system-generated fallbacks`);
      res.json({ success: true, data: enrichedData });
    } catch (error: any) {
      console.error("[Admin Location SEO] States ERROR:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to fetch state SEO overrides" });
    }
  });

  /**
   * Get cities with SEO metadata for admin management
   * Shows custom SEO overrides and system-generated fallbacks
   */
  app.get("/api/admin/location-seo/cities", requireRole("admin", "employee"), async (_req: Request, res: Response) => {
    try {
      console.log("[Admin Location SEO] Fetching cities...");
      
      const result = await pool.query(`
        SELECT
          c.name AS country_name,
          c.slug AS country_slug,
          s.name AS state_name,
          s.slug AS state_slug,
          ci.name AS city_name,
          ci.slug AS city_slug,
          COUNT(d.id) FILTER (WHERE d.status = 'active')::int AS total_detectives,
          lso.meta_title,
          lso.meta_description,
          lso.h1,
          (lso.id IS NOT NULL) as has_override,
          lso.updated_at
        FROM cities ci
        INNER JOIN states s ON ci.state_id = s.id
        INNER JOIN countries c ON ci.country_id = c.id
        LEFT JOIN detectives d ON d.city_id = ci.id
        LEFT JOIN location_seo_overrides lso
          ON lso.entity_type = 'city'
          AND lso.entity_id = ci.id::text
        WHERE ci.is_active = true
          AND s.is_active = true
          AND c.is_active = true
        GROUP BY
          c.id,
          c.name,
          c.slug,
          s.id,
          s.name,
          s.slug,
          ci.id,
          ci.name,
          ci.slug,
          lso.meta_title,
          lso.meta_description,
          lso.h1,
          lso.id,
          lso.updated_at
        ORDER BY
          c.slug ASC,
          s.slug ASC,
          ci.slug ASC
      `);

      // Generate system SEO for rows without overrides
      const year = new Date().getFullYear();
      const enrichedData = result.rows.map(row => ({
        country_slug: row.country_slug,
        state_slug: row.state_slug,
        city_slug: row.city_slug,
        total_detectives: row.total_detectives,
        custom_title: row.meta_title || `Top 10 Best Private Detectives in ${row.city_name}, ${row.state_name} (${year})`,
        custom_meta_description: row.meta_description || `Find trusted private detectives in ${row.city_name}, ${row.state_name}. Browse ${row.total_detectives} verified investigators offering background checks, surveillance, and investigation services.`,
        custom_h1: row.h1 || `Private Detectives in ${row.city_name}, ${row.state_name}`,
        has_override: row.has_override,
        updated_at: row.updated_at
      }));

      console.log(`[Admin Location SEO] Fetched ${enrichedData.length} cities with system-generated fallbacks`);
      res.json({ success: true, data: enrichedData });
    } catch (error: any) {
      console.error("[Admin Location SEO] Cities ERROR:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to fetch city SEO overrides" });
    }
  });

  /**
   * Save or update location SEO overrides
   * Supports country, state, and city level overrides
   * Uses UPSERT pattern to avoid duplicates
   */
  app.post("/api/admin/location-seo/override", requireRole("admin", "employee"), async (req: Request, res: Response) => {
    try {
      const { country_slug, state_slug, city_slug, custom_title, custom_meta_description, custom_h1 } = req.body;

      console.log("[Admin Location SEO Override] Processing request:", { country_slug, state_slug, city_slug });

      // Validate required fields
      if (!country_slug) {
        return res.status(400).json({ success: false, error: "country_slug is required" });
      }

      // Determine entity type and resolve entity ID
      let entityType: 'country' | 'state' | 'city';
      let entityId: string;

      if (city_slug && state_slug) {
        // City-level override
        entityType = 'city';
        const cityResult = await pool.query(
          `SELECT ci.id FROM cities ci
           INNER JOIN states s ON ci.state_id = s.id
           INNER JOIN countries c ON ci.country_id = c.id
           WHERE ci.slug = $1 AND s.slug = $2 AND c.slug = $3
           LIMIT 1`,
          [city_slug, state_slug, country_slug]
        );
        if (cityResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: "City not found" });
        }
        entityId = cityResult.rows[0].id.toString();
      } else if (state_slug) {
        // State-level override
        entityType = 'state';
        const stateResult = await pool.query(
          `SELECT s.id FROM states s
           INNER JOIN countries c ON s.country_id = c.id
           WHERE s.slug = $1 AND c.slug = $2
           LIMIT 1`,
          [state_slug, country_slug]
        );
        if (stateResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: "State not found" });
        }
        entityId = stateResult.rows[0].id.toString();
      } else {
        // Country-level override
        entityType = 'country';
        const countryResult = await pool.query(
          `SELECT id FROM countries WHERE slug = $1 LIMIT 1`,
          [country_slug]
        );
        if (countryResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: "Country not found" });
        }
        entityId = countryResult.rows[0].id.toString();
      }

      // Upsert the override
      const result = await pool.query(
        `INSERT INTO location_seo_overrides (entity_type, entity_id, meta_title, meta_description, h1)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (entity_type, entity_id)
         DO UPDATE SET
           meta_title = EXCLUDED.meta_title,
           meta_description = EXCLUDED.meta_description,
           h1 = EXCLUDED.h1,
           updated_at = NOW()
         RETURNING id, updated_at`,
        [entityType, entityId, custom_title || null, custom_meta_description || null, custom_h1 || null]
      );

      console.log(`[Admin Location SEO Override] Successfully saved override for ${entityType} ${entityId}`);
      
      res.json({ 
        success: true, 
        message: "SEO override saved successfully",
        data: {
          id: result.rows[0].id,
          updated_at: result.rows[0].updated_at
        }
      });

    } catch (error: any) {
      console.error("[Admin Location SEO Override] Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error?.message || "Failed to save SEO override",
        detail: error?.detail || null
      });
    }
  });
}
