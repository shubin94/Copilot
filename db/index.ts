import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
}

// Check if database is local (for production testing on localhost)
const isLocalDb = url?.includes("localhost") || url?.includes("127.0.0.1");

const pool = new Pool({
  connectionString: url,
  // Main application pool sizing - handles all API queries and transactions
  max: 15,                     // Max connections (prevents pool exhaustion on Supabase pooler)
  min: 2,                      // Keep 2 warm connections for faster cold requests
  idleTimeoutMillis: 30000,    // Close idle connections after 30s to free resources
  connectionTimeoutMillis: 5000, // Fail fast if pool is saturated (5s timeout)
  ssl: process.env.NODE_ENV === "production" && !isLocalDb
    ? { rejectUnauthorized: true }  // Production with remote DB: require SSL
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});
export const db = drizzle(pool, { schema });
export { pool };
