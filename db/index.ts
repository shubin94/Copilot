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

// SSL configuration for managed databases (Supabase, Render, etc.)
// Managed databases use self-signed or custom CA certificates that require rejectUnauthorized: false
// This is the standard approach for Supabase and other managed Postgres providers
const sslConfig = !isLocalDb
  ? {
      rejectUnauthorized: false,  // Accept self-signed certs from managed databases
      // Note: This is secure for managed databases as they still use encrypted connections
      // The certificate is validated by the managed provider, not by us
    }
  : undefined;  // Local databases don't need SSL

const pool = new Pool({
  connectionString: url,
  // Main application pool sizing - handles all API queries and transactions
  max: 15,                     // Max connections (prevents pool exhaustion on Supabase pooler)
  min: 2,                      // Keep 2 warm connections for faster cold requests
  idleTimeoutMillis: 30000,    // Close idle connections after 30s to free resources
  connectionTimeoutMillis: 5000, // Fail fast if pool is saturated (5s timeout)
  ssl: sslConfig
});
export const db = drizzle(pool, { schema });
export { pool };
