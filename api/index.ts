/**
 * Vercel Serverless Function Entry Point
 * 
 * Routes all HTTP requests through the Express app, bypassing Vercel's
 * static file serving and 404 page. This ensures:
 * - All requests handled by Express app
 * - Database initialization and migration on cold start
 * - SSR route handling (/detectives/:country/:state/:city/:agency)
 * - Static file serving from dist/public via Express
 * - API proxy routing
 * - Client-side SPA fallback
 * 
 * This is critical for hybrid SSR+SPA apps on Vercel - prevents 404s
 * for deep dynamic routes.
 */

// Simply import and use the server handler
export default async (req: any, res: any) => {
  try {
    // Import the reusable initialization handler
    const { produceServerHandler } = await import('../../server/vercel-handler');
    const handler = await produceServerHandler();
    return handler(req, res);
  } catch (error) {
    console.error('❌ Vercel handler error:', error);
    res.status(500).json({ 
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
