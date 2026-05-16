import type { Express, Request, Response } from "express";
import { pool } from "../../db/index.js";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../authMiddleware.js";
import * as LocationService from "../services/locationService.js";

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
   * Get all countries with active detective counts
   * Used for dedicated countries listing page
   */
  app.get("/api/locations/countries-list", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 500, 1000);

      const result = await pool.query(
        `
          SELECT c.name, c.slug, COUNT(d.id)::int AS detective_count
          FROM detectives d
          INNER JOIN countries c ON d.country_id = c.id
          WHERE d.status = 'active'
          GROUP BY c.id, c.name, c.slug
          ORDER BY COUNT(d.id) DESC
          LIMIT $1
        `,
        [limit]
      );

      const countries = result.rows
        .map((row: any) => ({
          name: row.name,
          slug: row.slug,
          detectiveCount: Number(row.detective_count) || 0,
        }))
        .filter((item: any) => item.detectiveCount > 0);

      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ countries });
    } catch (error) {
      console.error("[API /api/locations/countries-list] Error:", error);
      res.status(500).json({ error: "Failed to fetch countries list", countries: [] });
    }
  });

  /**
   * Get all states with active detective counts
   * Used for dedicated states listing page
   */
  app.get("/api/locations/states-list", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 500, 1000);

      const result = await pool.query(
        `
          SELECT s.name, s.slug, c.slug AS country_slug, COUNT(d.id)::int AS detective_count
          FROM detectives d
          INNER JOIN countries c ON d.country_id = c.id
          INNER JOIN states s ON d.state_id = s.id AND s.country_id = c.id
          WHERE d.status = 'active'
          GROUP BY s.id, s.name, s.slug, c.slug
          ORDER BY COUNT(d.id) DESC
          LIMIT $1
        `,
        [limit]
      );

      const states = result.rows
        .map((row: any) => ({
          name: row.name,
          slug: row.slug,
          countrySlug: row.country_slug,
          detectiveCount: Number(row.detective_count) || 0,
        }))
        .filter((item: any) => item.detectiveCount > 0);

      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ states });
    } catch (error) {
      console.error("[API /api/locations/states-list] Error:", error);
      res.status(500).json({ error: "Failed to fetch states list", states: [] });
    }
  });

  /**
   * Get all cities with active detective counts
   * Used for dedicated cities listing page
   */
  app.get("/api/locations/cities-list", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 1000, 2000);

      const result = await pool.query(
        `
          SELECT ci.name, ci.slug, s.slug AS state_slug, c.slug AS country_slug, COUNT(d.id)::int AS detective_count
          FROM detectives d
          INNER JOIN countries c ON d.country_id = c.id
          INNER JOIN states s ON d.state_id = s.id AND s.country_id = c.id
          INNER JOIN cities ci ON d.city_id = ci.id AND ci.state_id = s.id
          WHERE d.status = 'active'
          GROUP BY ci.id, ci.name, ci.slug, s.slug, c.slug
          ORDER BY COUNT(d.id) DESC
          LIMIT $1
        `,
        [limit]
      );

      const cities = result.rows
        .map((row: any) => ({
          name: row.name,
          slug: row.slug,
          stateSlug: row.state_slug,
          countrySlug: row.country_slug,
          detectiveCount: Number(row.detective_count) || 0,
        }))
        .filter((item: any) => item.detectiveCount > 0);

      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ cities });
    } catch (error) {
      console.error("[API /api/locations/cities-list] Error:", error);
      res.status(500).json({ error: "Failed to fetch cities list", cities: [] });
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

  /**
   * Get top states within a specific country
   * Used for "Top States in {Country}" section on country detective pages
   */
  app.get("/api/locations/top-states/:countrySlug", async (req: Request, res: Response) => {
    try {
      const { countrySlug } = req.params;
      const limit = Math.min(Number(req.query.limit) || 10, 50);

      const topStates = await storage.getTopStatesByCountry(countrySlug, limit);

      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      res.json({ states: topStates });
    } catch (error) {
      console.error("[API /api/locations/top-states] Error:", error);
      res.status(500).json({ error: "Failed to fetch top states", states: [] });
    }
  });

  /**
   * Get top cities within a specific state
   * Used for "Top Cities in {State}" section on state detective pages
   */
  app.get("/api/locations/top-cities/:countrySlug/:stateSlug", async (req: Request, res: Response) => {
    try {
      const { countrySlug, stateSlug } = req.params;
      const limit = Math.min(Number(req.query.limit) || 10, 50);

      const topCities = await storage.getTopCitiesByState(countrySlug, stateSlug, limit);

      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      res.json({ cities: topCities });
    } catch (error) {
      console.error("[API /api/locations/top-cities] Error:", error);
      res.status(500).json({ error: "Failed to fetch top cities", cities: [] });
    }
  });

  /**
   * Get other cities within a state (excluding current city)
   * Used for "Other Cities in {State}" section on city detective pages
   */
  app.get("/api/locations/other-cities/:countrySlug/:stateSlug/:citySlug", async (req: Request, res: Response) => {
    try {
      const { countrySlug, stateSlug, citySlug } = req.params;
      const limit = Math.min(Number(req.query.limit) || 10, 50);

      const otherCities = await storage.getOtherCitiesByState(countrySlug, stateSlug, citySlug, limit);

      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      res.json({ cities: otherCities });
    } catch (error) {
      console.error("[API /api/locations/other-cities] Error:", error);
      res.status(500).json({ error: "Failed to fetch other cities", cities: [] });
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
          ON lso.entity_type = 'country' AND lso.entity_id = c.id::text
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
          ON lso.entity_type = 'state' AND lso.entity_id = s.id::text
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
        INNER JOIN countries c ON s.country_id = c.id
        LEFT JOIN detectives d ON d.city_id = ci.id
        LEFT JOIN location_seo_overrides lso
          ON lso.entity_type = 'city' AND lso.entity_id = ci.id::text
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
        country_name: row.country_name,
        state_slug: row.state_slug,
        state_name: row.state_name,
        city_slug: row.city_slug,
        city_name: row.city_name,
        total_detectives: row.total_detectives,
        custom_title: row.meta_title || `Top 10 Best Private Detectives in ${row.city_name}, ${row.state_name} (${year})`,
        custom_meta_description: row.meta_description || `Find trusted private detectives in ${row.city_name}, ${row.state_name}. Browse ${row.total_detectives} verified investigators offering background checks, surveillance, and investigation services.`,
        custom_h1: row.h1 || `Private Detectives in ${row.city_name}, ${row.state_name}`,
        is_custom: row.has_override,
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
   * Get service-location pages with SEO metadata for admin management
   * Query params: level (country|state|city), category (slug), country_slug, state_slug
   */
  app.get("/api/admin/location-seo/service-locations", requireRole("admin", "employee"), async (req: Request, res: Response) => {
    try {
      const level = (req.query.level as string) || 'country';
      const category = (req.query.category as string) || 'background-checks';
      const countryFilter = req.query.country_slug as string || '';
      const stateFilter = req.query.state_slug as string || '';

      const year = new Date().getFullYear();

      // Resolve category slug → category name by matching against actual service categories in the DB
      const slugToName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
      let categoryName: string | null = null;

      // First: try matching against service_categories table
      const allCats = await storage.getAllServiceCategories(false);
      for (const cat of allCats) {
        const variants = [
          slugToName(cat.name),
          slugToName(cat.name) + 's',
        ];
        if (variants.includes(category)) {
          categoryName = cat.name;
          break;
        }
      }

      // Fallback: match directly against distinct category names used in actual services
      if (!categoryName) {
        const distinctRow = await pool.query(
          `SELECT MIN(TRIM(category)) AS name FROM services
           WHERE is_active = true AND TRIM(category) != ''
           GROUP BY LOWER(TRIM(category))
           HAVING $1 = ANY(ARRAY[
             regexp_replace(lower(trim(category)),'[^a-z0-9]+','-','g'),
             regexp_replace(lower(trim(category)),'[^a-z0-9]+','-','g') || 's'
           ])
           LIMIT 1`,
          [category]
        );
        if (distinctRow.rows.length > 0) {
          categoryName = distinctRow.rows[0].name;
        }
      }

      if (level === 'city') {
        const result = await pool.query(`
          SELECT
            c.slug AS country_slug, c.name AS country_name,
            s.slug AS state_slug, s.name AS state_name,
            ci.slug AS city_slug, ci.name AS city_name,
            COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active' AND ($4::text IS NULL OR svc.detective_id IS NOT NULL))::int AS total_detectives,
            lso.meta_title, lso.meta_description, lso.h1,
            (lso.id IS NOT NULL) AS has_override, lso.updated_at
          FROM cities ci
          INNER JOIN states s ON ci.state_id = s.id
          INNER JOIN countries c ON s.country_id = c.id
          LEFT JOIN detectives d ON d.city_id = ci.id AND d.status = 'active'
          LEFT JOIN (
            SELECT DISTINCT detective_id FROM services
            WHERE is_active = true
              AND images IS NOT NULL AND array_length(images, 1) > 0
              AND ($4::text IS NULL OR LOWER(category) = LOWER($4::text))
          ) svc ON svc.detective_id = d.id
          LEFT JOIN service_location_seo lso
            ON lso.service_slug = $1
            AND lso.country_slug = c.slug
            AND lso.state_slug = s.slug
            AND lso.city_slug = ci.slug
          WHERE ci.is_active = true AND s.is_active = true AND c.is_active = true
            AND ($2 = '' OR c.slug = $2)
            AND ($3 = '' OR s.slug = $3)
          GROUP BY c.id, c.slug, c.name, s.id, s.slug, s.name, ci.id, ci.slug, ci.name,
            lso.meta_title, lso.meta_description, lso.h1, lso.id, lso.updated_at
          HAVING COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active' AND ($4::text IS NULL OR svc.detective_id IS NOT NULL)) > 0
          ORDER BY c.slug, s.slug, ci.slug
          LIMIT 5000
        `, [category, countryFilter, stateFilter, categoryName]);

        const data = result.rows.map((row: any) => ({
          category_slug: category,
          country_slug: row.country_slug,
          state_slug: row.state_slug,
          city_slug: row.city_slug,
          location_label: `${row.city_name}, ${row.state_name}, ${row.country_name}`,
          total_detectives: row.total_detectives,
          custom_title: row.meta_title || `${category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} in ${row.city_name}, ${row.state_name} | Verified Detectives (${year})`,
          custom_meta_description: row.meta_description || `Find verified ${category.replace(/-/g, ' ')} services in ${row.city_name}, ${row.state_name}. Compare ${row.total_detectives} providers with reviews, pricing & contact.`,
          custom_h1: row.h1 || `${category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} in ${row.city_name}, ${row.state_name}`,
          has_override: row.has_override,
          updated_at: row.updated_at,
        }));

        return res.json({ success: true, data });

      } else if (level === 'state') {
        const result = await pool.query(`
          SELECT
            c.slug AS country_slug, c.name AS country_name,
            s.slug AS state_slug, s.name AS state_name,
            COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active' AND ($3::text IS NULL OR svc.detective_id IS NOT NULL))::int AS total_detectives,
            lso.meta_title, lso.meta_description, lso.h1,
            (lso.id IS NOT NULL) AS has_override, lso.updated_at
          FROM states s
          INNER JOIN countries c ON s.country_id = c.id
          LEFT JOIN detectives d ON d.state_id = s.id AND d.status = 'active'
          LEFT JOIN (
            SELECT DISTINCT detective_id FROM services
            WHERE is_active = true
              AND images IS NOT NULL AND array_length(images, 1) > 0
              AND ($3::text IS NULL OR LOWER(category) = LOWER($3::text))
          ) svc ON svc.detective_id = d.id
          LEFT JOIN service_location_seo lso
            ON lso.service_slug = $1
            AND lso.country_slug = c.slug
            AND lso.state_slug = s.slug
            AND lso.city_slug IS NULL
          WHERE s.is_active = true AND c.is_active = true
            AND ($2 = '' OR c.slug = $2)
          GROUP BY c.id, c.slug, c.name, s.id, s.slug, s.name,
            lso.meta_title, lso.meta_description, lso.h1, lso.id, lso.updated_at
          HAVING COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active' AND ($3::text IS NULL OR svc.detective_id IS NOT NULL)) > 0
          ORDER BY c.slug, s.slug
          LIMIT 5000
        `, [category, countryFilter, categoryName]);

        const data = result.rows.map((row: any) => ({
          category_slug: category,
          country_slug: row.country_slug,
          state_slug: row.state_slug,
          city_slug: null,
          location_label: `${row.state_name}, ${row.country_name}`,
          total_detectives: row.total_detectives,
          custom_title: row.meta_title || `${category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} in ${row.state_name}, ${row.country_name} | Verified Detectives (${year})`,
          custom_meta_description: row.meta_description || `Find verified ${category.replace(/-/g, ' ')} services in ${row.state_name}, ${row.country_name}. Compare ${row.total_detectives} providers with reviews, pricing & contact.`,
          custom_h1: row.h1 || `${category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} in ${row.state_name}, ${row.country_name}`,
          has_override: row.has_override,
          updated_at: row.updated_at,
        }));

        return res.json({ success: true, data });

      } else {
        // country level
        const result = await pool.query(`
          SELECT
            c.slug AS country_slug, c.name AS country_name,
            COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active' AND ($2::text IS NULL OR svc.detective_id IS NOT NULL))::int AS total_detectives,
            lso.meta_title, lso.meta_description, lso.h1,
            (lso.id IS NOT NULL) AS has_override, lso.updated_at
          FROM countries c
          LEFT JOIN detectives d ON d.country_id = c.id AND d.status = 'active'
          LEFT JOIN (
            SELECT DISTINCT detective_id FROM services
            WHERE is_active = true
              AND images IS NOT NULL AND array_length(images, 1) > 0
              AND ($2::text IS NULL OR LOWER(category) = LOWER($2::text))
          ) svc ON svc.detective_id = d.id
          LEFT JOIN service_location_seo lso
            ON lso.service_slug = $1
            AND lso.country_slug = c.slug
            AND lso.state_slug IS NULL
            AND lso.city_slug IS NULL
          WHERE c.is_active = true
          GROUP BY c.id, c.slug, c.name,
            lso.meta_title, lso.meta_description, lso.h1, lso.id, lso.updated_at
          HAVING COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active' AND ($2::text IS NULL OR svc.detective_id IS NOT NULL)) > 0
          ORDER BY c.slug
        `, [category, categoryName]);

        const data = result.rows.map((row: any) => ({
          category_slug: category,
          country_slug: row.country_slug,
          state_slug: null,
          city_slug: null,
          location_label: row.country_name,
          total_detectives: row.total_detectives,
          custom_title: row.meta_title || `${category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} in ${row.country_name} | Verified Detectives (${year})`,
          custom_meta_description: row.meta_description || `Find verified ${category.replace(/-/g, ' ')} services in ${row.country_name}. Compare ${row.total_detectives} providers with reviews, pricing & contact.`,
          custom_h1: row.h1 || `${category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} in ${row.country_name}`,
          has_override: row.has_override,
          updated_at: row.updated_at,
        }));

        return res.json({ success: true, data });
      }

    } catch (error: any) {
      console.error("[Admin Service Location SEO] Error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to fetch service location SEO data" });
    }
  });

  /**
   * Data audit: detectives whose state/city text doesn't match their FK
   * GET /api/admin/location-audit
   */
  app.get("/api/admin/location-audit", requireRole("admin", "employee"), async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          d.id,
          d.business_name,
          d.slug,
          d.status,
          d.state  AS detective_state_text,
          s.name   AS fk_state_name,
          d.city   AS detective_city_text,
          ci.name  AS fk_city_name
        FROM detectives d
        LEFT JOIN states s  ON d.state_id  = s.id
        LEFT JOIN cities ci ON d.city_id   = ci.id
        WHERE d.status = 'active'
          AND (
            (d.state_id IS NULL AND d.state IS NOT NULL AND TRIM(d.state) != '')
            OR (s.id IS NOT NULL AND LOWER(TRIM(d.state)) != LOWER(TRIM(s.name)))
            OR (d.city_id IS NULL AND d.city IS NOT NULL AND TRIM(d.city) != '')
            OR (ci.id IS NOT NULL AND LOWER(TRIM(d.city)) != LOWER(TRIM(ci.name)))
          )
        ORDER BY d.business_name
        LIMIT 200
      `);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message });
    }
  });

  /**
   * Save or update location SEO overrides
   * Supports country, state, city, and service-location level overrides
   * Uses UPSERT pattern to avoid duplicates
   */
  // POST /api/admin/detective-seo
  app.post("/api/admin/detective-seo", requireRole("admin", "employee"), async (req: Request, res: Response) => {
    try {
      const { country_slug, state_slug, city_slug, custom_title, custom_meta_description, custom_h1 } = req.body;
      if (!country_slug) {
        return res.status(400).json({ success: false, error: "country_slug is required" });
      }
      // Resolve slugs → integer IDs for location_seo_overrides
      const countryRow = await pool.query(`SELECT id FROM countries WHERE slug = $1 LIMIT 1`, [country_slug]);
      if (!countryRow.rows.length) {
        return res.status(400).json({ success: false, error: "Country not found" });
      }
      const countryId = countryRow.rows[0].id;
      let entityType = 'country';
      let entityId = String(countryId);

      if (state_slug) {
        const stateRow = await pool.query(`SELECT id FROM states WHERE slug = $1 AND country_id = $2 LIMIT 1`, [state_slug, countryId]);
        if (stateRow.rows.length > 0) {
          const stateId = stateRow.rows[0].id;
          entityType = 'state';
          entityId = String(stateId);

          if (city_slug) {
            const cityRow = await pool.query(`SELECT id FROM cities WHERE slug = $1 AND state_id = $2 LIMIT 1`, [city_slug, stateId]);
            if (cityRow.rows.length > 0) {
              entityType = 'city';
              entityId = String(cityRow.rows[0].id);
            }
          }
        }
      }

      // Upsert into location_seo_overrides (single source of truth for detective location SEO)
      const result = await pool.query(
        `INSERT INTO location_seo_overrides (id, entity_type, entity_id, h1, meta_title, meta_description)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET
           h1               = EXCLUDED.h1,
           meta_title       = EXCLUDED.meta_title,
           meta_description = EXCLUDED.meta_description,
           updated_at       = NOW()
         RETURNING entity_type, entity_id, updated_at`,
        [entityType, entityId, custom_h1 || null, custom_title || null, custom_meta_description || null]
      );

      res.json({ success: true, message: "Detective SEO saved", data: result.rows[0] });
    } catch (error: any) {
      console.error("[Admin Detective SEO] Error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to save detective SEO" });
    }
  });

  // POST /api/admin/service-location-seo
  app.post("/api/admin/service-location-seo", requireRole("admin", "employee"), async (req: Request, res: Response) => {
    try {
      const { category_slug, country_slug, state_slug, city_slug, custom_title, custom_meta_description, custom_h1 } = req.body;
      if (!category_slug || !country_slug) {
        return res.status(400).json({ success: false, error: "category_slug and country_slug are required" });
      }
      // Upsert into service_location_seo
      const result = await pool.query(
        `INSERT INTO service_location_seo (service_slug, country_slug, state_slug, city_slug, meta_title, meta_description, h1)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (service_slug, country_slug, COALESCE(state_slug, ''), COALESCE(city_slug, ''))
         DO UPDATE SET
           meta_title = EXCLUDED.meta_title,
           meta_description = EXCLUDED.meta_description,
           h1 = EXCLUDED.h1,
           updated_at = NOW()
         RETURNING service_slug, country_slug, state_slug, city_slug, updated_at`,
        [category_slug, country_slug, state_slug || null, city_slug || null, custom_title || null, custom_meta_description || null, custom_h1 || null]
      );
      res.json({ success: true, message: "Service Location SEO saved", data: result.rows[0] });
    } catch (error: any) {
      console.error("[Admin Service Location SEO] Error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to save service location SEO" });
    }
  });
}
