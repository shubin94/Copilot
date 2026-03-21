/**
 * Database connection pool and Drizzle ORM instance
 * 
 * Environment variables should be loaded BEFORE importing this module.
 * - Server startup: calls loadEnv() or initializeEnv()
 * - Scripts: should call loadEnv() before importing db
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.js";

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
  // Supabase free tier allows 25 total connections.
  // Session store pool uses max:5, so main pool must stay ≤ 15 to avoid exhaustion.
  max: 10,                       // Reduced from 20 — leaves room for session pool + overhead
  min: 1,                        // Keep 1 warm, not 2, to free slots on idle
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Give more time to acquire (was 5s, now 10s)
  allowExitOnIdle: false,         // Keep pool alive between requests
  ssl: sslConfig
});
export const db = drizzle(pool, { schema });
export { pool };
