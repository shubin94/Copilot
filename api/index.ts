import "./lib/loadEnv.ts"
import serverlessHttp from "serverless-http"
import { app } from "../server/app.ts"
import { registerRoutes } from "../server/routes.ts"
import { loadSecretsFromDatabase } from "../server/lib/secretsLoader.ts"
import { validateDatabase } from "../server/startup.ts"

let handler: any
let initialized = false

/**
 * Vercel Serverless Function Handler
 * 
 * This function handles:
 * 1. All /api/* routes (backend API)
 * 2. Fallback for dynamic routes (handled via vercel.json rewrite)
 * 
 * Static files (JS, CSS, images) are served directly by Vercel's CDN
 * HTML files are rewritten to index.html for SPA routing
 */
export default async function api(req: any, res: any) {
  if (!initialized) {
    try {
      console.log("[Vercel Serverless] Initializing...")
      
      // Load environment variables
      const { initializeEnv } = await import("../server/lib/loadEnv.ts")
      await initializeEnv()
      
      // Load secrets from database
      await loadSecretsFromDatabase()
      
      // Validate database connection
      await validateDatabase()
      
      // Register all API routes
      await registerRoutes(app)
      
      // Create serverless handler
      handler = serverlessHttp(app)
      initialized = true
      
      console.log("[Vercel Serverless] Ready")
    } catch (error) {
      console.error("[Vercel Serverless] Init failed:", error)
      res.status(500).json({ error: "Server initialization failed", details: String(error) })
      return
    }
  }
  
  return handler(req, res)
}
