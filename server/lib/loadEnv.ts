/**
 * Environment Variable Loader
 * 
 * Loads .env files based on NODE_ENV with safety guards:
 * - development: loads .env or .env.local
 * - production: relies ONLY on process.env (no files)
 * - test: loads test-safe configuration
 * 
 * Rules:
 * - Never load .env.production or committed secret files
 * - Production never reads from files (injected vars only)
 * - Logs which file was loaded and from where
 * - Fails fast if required vars are missing
 */

import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../");

type NodeEnv = "development" | "production" | "test" | undefined;

interface LoadEnvResult {
  nodeEnv: NodeEnv;
  envFile: string | null;
  source: "process.env" | "file" | "none";
  loadedVars: string[];
}

/**
 * Get the appropriate .env file path based on NODE_ENV
 */
function getEnvFilePath(env: NodeEnv): { path: string | null; mustExist: boolean } {
  switch (env) {
    case "production":
      // Production NEVER loads from files - only from injected env vars
      return { path: null, mustExist: false };

    case "test":
      // Test can use .env.test if it exists, fallback to .env.local or .env
      if (fs.existsSync(path.join(projectRoot, ".env.test"))) {
        return { path: path.join(projectRoot, ".env.test"), mustExist: false };
      }
      if (fs.existsSync(path.join(projectRoot, ".env.local"))) {
        return { path: path.join(projectRoot, ".env.local"), mustExist: false };
      }
      return { path: path.join(projectRoot, ".env"), mustExist: false };

    case "development":
    case undefined:
      // Development: prefer .env.local, fallback to .env
      if (fs.existsSync(path.join(projectRoot, ".env.local"))) {
        return { path: path.join(projectRoot, ".env.local"), mustExist: true };
      }
      return { path: path.join(projectRoot, ".env"), mustExist: false };

    default:
      return { path: null, mustExist: false };
  }
}

/**
 * Load environment variables safely based on NODE_ENV
 */
export function loadEnv(): LoadEnvResult {
  const nodeEnv = (process.env.NODE_ENV as NodeEnv) || "development";
  const envPath = getEnvFilePath(nodeEnv);
  const loadedVars: string[] = [];
  let loadedFile: string | null = null;
  let source: "process.env" | "file" | "none" = "none";

  // Load from file if applicable
  if (envPath.path) {
    if (fs.existsSync(envPath.path)) {
      try {
        const result = dotenv.config({ path: envPath.path });
        if (result.parsed) {
          loadedVars.push(...Object.keys(result.parsed));
          loadedFile = envPath.path;
          source = "file";
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load env file ${envPath.path}: ${message}`);
      }
    } else if (envPath.mustExist) {
      throw new Error(
        `Expected .env.local or .env file in development mode, but none found at ${projectRoot}`
      );
    }
  } else if (nodeEnv === "production") {
    // Production uses injected env vars only
    source = "process.env";
  }

  return {
    nodeEnv,
    envFile: loadedFile,
    source,
    loadedVars,
  };
}

/**
 * Log environment loading for debugging
 */
export function logEnvLoaded(result: LoadEnvResult): void {
  console.log("\n📋 Environment Configuration Loaded:");
  console.log(`   NODE_ENV: ${result.nodeEnv || "development"}`);
  console.log(`   Source: ${result.source}`);
  if (result.envFile) {
    console.log(`   File: ${path.relative(projectRoot, result.envFile)}`);
    console.log(`   Variables: ${result.loadedVars.length} keys loaded`);
  } else if (result.source === "process.env") {
    console.log(`   Note: Production mode - using injected environment variables only`);
  }
  console.log();
}

/**
 * Validate that required environment variables are set
 */
export function validateRequiredEnv(required: string[]): { missing: string[] } {
  const missing = required.filter((key) => !process.env[key]);
  return { missing };
}

/**
 * Initialize environment (call once at application startup)
 */
export async function initializeEnv(): Promise<void> {
  try {
    const result = loadEnv();
    logEnvLoaded(result);

    // Validate production requirements
    if (result.nodeEnv === "production") {
      const { missing } = validateRequiredEnv(["DATABASE_URL"]);
      if (missing.length > 0) {
        throw new Error(
          `Missing required environment variables in production: ${missing.join(", ")}`
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Environment initialization failed: ${message}`);
    throw error;
  }
}

/**
 * AUTO-INITIALIZE: Environment is loaded when this module is imported
 * This allows scripts to simply use: import "../server/lib/loadEnv";
 */
loadEnv();
