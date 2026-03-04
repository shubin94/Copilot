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
 * OPTIMIZED: Handler caching prevents re-initialization on warm requests
 */

import { produceServerHandler } from "../server/vercel-handler.js";

// ✅ Module-level cache: Persistent across requests in a warm instance
let cachedHandler: any = null;

// Enable garbage collection between invocations
if (global.gc) {
  global.gc();
}

export default async (req: any, res: any) => {
  try {
    // ✅ OPTIMIZATION: Reuse cached handler instead of re-initializing
    // On first request (cold start): Initialize handler + store in cache
    // On subsequent requests (warm): Reuse cached handler immediately
    // This prevents re-initializing database connections, middleware, routes on every request
    if (!cachedHandler) {
      console.log('[Vercel] Cold start: Initializing handler...');
      cachedHandler = await produceServerHandler();
    } else {
      console.log('[Vercel] Warm request: Reusing cached handler');
    }
    
    // Mark the response to enable compression if not already set
    if (!res.getHeader('Content-Encoding')) {
      res.setHeader('Vary', 'Accept-Encoding');
    }
    
    return cachedHandler(req, res);
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
