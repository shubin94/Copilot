import { type Express, type Request, type Response } from "express";
import { db } from "../index.ts";
import { services, detectives } from "../../shared/schema.ts";
import { eq, and, isNotNull, sql } from "drizzle-orm";

/**
 * Debug endpoint to check image URLs and storage issues
 */
export async function registerImageDebugRoutes(app: Express) {
  // Check first 10 services with images
  app.get("/api/debug/images/services", async (req: Request, res: Response) => {
    try {
      const result = await db.select({
        id: services.id,
        title: services.title,
        images: services.images,
        detectiveId: services.detectiveId,
      })
        .from(services)
        .where(
          and(
            isNotNull(services.images),
            sql`array_length(${services.images}, 1) > 0`
          )
        )
        .limit(5);

      const servicesData = result.map(s => ({
        id: s.id,
        title: s.title,
        imageCount: Array.isArray(s.images) ? s.images.length : 0,
        images: Array.isArray(s.images) ? s.images.slice(0, 2) : [], // First 2 images
      }));

      return res.json({
        success: true,
        count: servicesData.length,
        services: servicesData,
      });
    } catch (error) {
      console.error("[DEBUG] Error fetching service images:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Check first 10 detectives with logos
  app.get("/api/debug/images/detectives", async (req: Request, res: Response) => {
    try {
      const result = await db.select({
        id: detectives.id,
        businessName: detectives.businessName,
        logo: detectives.logo,
      })
        .from(detectives)
        .where(isNotNull(detectives.logo))
        .limit(5);

      const detectivesData = result.map(d => ({
        id: d.id,
        businessName: d.businessName,
        logo: d.logo,
        isSupabase: d.logo?.includes('.supabase.co') ?? false,
        isBase64: d.logo?.startsWith('data:') ?? false,
      }));

      return res.json({
        success: true,
        count: detectivesData.length,
        detectives: detectivesData,
      });
    } catch (error) {
      console.error("[DEBUG] Error fetching detective logos:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Test image URL accessibility
  app.post("/api/debug/images/test-url", async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: "URL required" });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        return res.json({
          success: true,
          url: url.substring(0, 100),
          status: response.status,
          contentType: response.headers.get('content-type'),
          corsHeaders: {
            'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
            'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
          },
        });
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      console.error("[DEBUG] Error testing image URL:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  console.log("[DEBUG] Image debug routes registered");
}
