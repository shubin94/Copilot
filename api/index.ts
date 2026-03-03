/**
 * Vercel Serverless Function Entry Point
 * 
 * Routes all HTTP requests through the Express app, bypassing Vercel's
 * static file serving and 404 page. This ensures:
 * - All requests handled by Express app
 * - Database initialization on cold start
 * - SSR route handling (/detectives/:country/:state/:city/:agency)
 * - Static file serving from dist/public via Express
 * - API proxy routing
 * - Client-side SPA fallback
 * 
 * OPTIMIZED: Uses lazy loading & memory optimization to fit within 2048MB limit
 */

// Enable garbage collection between invocations
if (global.gc) {
  global.gc();
}

export default async (req: any, res: any) => {
  try {
    // OPTIMIZATION: Lazy import serverless handler to defer route loading
    const { produceServerHandler } = await import('../server/vercel-handler.js');
    const handler = await produceServerHandler();
    
    // Mark the response to enable compression if not already set
    if (!res.getHeader('Content-Encoding')) {
      res.setHeader('Vary', 'Accept-Encoding');
    }
    
    return handler(req, res);
  } catch (error) {
    console.error('❌ Vercel handler error:', error);
    
    // Return appropriate error response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
};
