/**
 * Database Validation & Safety
 * 
 * Prevents accidental operations on production databases by:
 * - Detecting local vs remote databases
 * - Requiring explicit confirmation for non-local ops
 * - Logging masked connection details
 * - Blocking destructive ops in production mode unless allowed
 */

import * as readline from "node:readline";

interface DatabaseInfo {
  url: string;
  host: string | null;
  port: number | null;
  database: string | null;
  isLocal: boolean;
  isProduction: boolean;
  displayUrl: string; // masked for logging
}

/**
 * Parse PostgreSQL connection string to extract details
 */
export function parseDatabaseUrl(url: string): DatabaseInfo {
  try {
    // Parse PostgreSQL connection string - handle both "postgresql://" and "postgres://" schemes
    const normalizedUrl = url.replace(/^postgres(ql)?:\/\//, "http://");
    const dbUrl = new URL(normalizedUrl);
    const host = dbUrl.hostname || null;
    const port = dbUrl.port ? parseInt(dbUrl.port, 10) : 5432;
    const database = dbUrl.pathname?.replace("/", "") || null;
    const username = dbUrl.username ? decodeURIComponent(dbUrl.username) : "postgres";

    // Check if local
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host?.endsWith(".local");

    // Mask password for display - handle both postgresql:// and postgres:// schemes
    let displayUrl = url;
    try {
      // Detect both postgresql:// and postgres:// schemes
      const schemeMatch = url.match(/^(postgres(?:ql)?):\/\//);
      if (!schemeMatch) {
        displayUrl = url;
      } else {
        const schemeLength = schemeMatch[0].length;
        const afterScheme = url.substring(schemeLength);
        const atIndex = afterScheme.indexOf('@');
        if (atIndex > 0) {
          const credPart = afterScheme.substring(0, atIndex);
          const colonInCred = credPart.indexOf(':');
          if (colonInCred > 0) {
            // Found user:password format - mask the password part
            const user = credPart.substring(0, colonInCred);
            displayUrl = url.replace(credPart, user + ":***");
          }
        }
      }
    } catch {
      // Fallback: simple regex that handles most cases
      displayUrl = url.replace(/:(?:[^@]+)@/, ":***@");
    }

    return {
      url,
      host: host || "unknown",
      port,
      database: database || "postgres",
      isLocal,
      isProduction: !isLocal,
      displayUrl,
    };
  } catch (error) {
    return {
      url,
      host: null,
      port: null,
      database: null,
      isLocal: false,
      isProduction: true,
      displayUrl: (() => {
        try {
          // Handle both 'postgres://' and 'postgresql://' schemes
          const schemeMatch = url.match(/^(postgres(?:ql)?):\/\//);
          if (!schemeMatch) {
            return url;
          }
          const schemeLength = schemeMatch[0].length;
          const afterScheme = url.substring(schemeLength);
          const atIndex = afterScheme.indexOf('@');
          if (atIndex > 0) {
            const credPart = afterScheme.substring(0, atIndex);
            const colonInCred = credPart.indexOf(':');
            if (colonInCred > 0) {
              const user = credPart.substring(0, colonInCred);
              return url.replace(credPart, user + ":***");
            }
          }
        } catch {}
        return url.replace(/:(?:[^@]+)@/, ":***@");
      })(),
    };
  }
}

/**
 * Log database connection details
 */
export function logDatabaseInfo(dbInfo: DatabaseInfo, label = "Database Connection"): void {
  console.log(`\n🗄️  ${label}:`);
  console.log(`   Host: ${dbInfo.host}:${dbInfo.port || 5432}`);
  console.log(`   Database: ${dbInfo.database}`);
  console.log(`   Environment: ${dbInfo.isLocal ? "LOCAL" : "REMOTE"}`);
  if (!dbInfo.isLocal) {
    console.log(`   ⚠️  WARNING: Non-local database detected`);
  }
  console.log();
}

/**
 * Prompt user for confirmation (async)
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

/**
 * Validate database before destructive operations
 */
export async function validateDatabaseForOperation(
  url: string | undefined,
  operation: string = "operation",
  options: {
    allowProduction?: boolean;
    requireConfirmation?: boolean;
    nodeEnv?: string;
  } = {}
): Promise<{ allowed: boolean; reason?: string }> {
  if (!url) {
    return { allowed: false, reason: "DATABASE_URL not set" };
  }

  const dbInfo = parseDatabaseUrl(url);
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV;

  // Log what we're about to do
  console.log(`\n⚠️  About to run: ${operation}`);
  logDatabaseInfo(dbInfo, "Target Database");

  // Block if production without explicit allowance
  if (dbInfo.isProduction && nodeEnv === "production") {
    if (!options.allowProduction) {
      console.error("❌ BLOCKED: Cannot run destructive operations on production database");
      console.error("   Set NODE_ENV=development or use ALLOW_PRODUCTION_OPS=true");
      return {
        allowed: false,
        reason: "Production database protected",
      };
    }
  }

  // Require confirmation for non-local databases
  if (dbInfo.isProduction && options.requireConfirmation !== false) {
    console.warn(
      `\n🔴 DANGER: This will modify data on ${dbInfo.host}:${dbInfo.port || 5432}`
    );
    const confirmed = await promptConfirmation(
      "Type 'YES' to continue, or anything else to cancel: "
    );

    if (!confirmed) {
      console.log("Operation cancelled.");
      return { allowed: false, reason: "User cancelled operation" };
    }
  }

  return { allowed: true };
}

/**
 * Check if environment is safe for automated operations
 */
export function isSafeEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  const url = process.env.DATABASE_URL;

  if (!url) return false;

  const dbInfo = parseDatabaseUrl(url);
  return dbInfo.isLocal || nodeEnv !== "production";
}

/**
 * Get color-coded environment indicator
 */
export function getEnvironmentBadge(): string {
  const nodeEnv = process.env.NODE_ENV || "development";
  const url = process.env.DATABASE_URL || "";
  const dbInfo = parseDatabaseUrl(url);

  if (nodeEnv === "production" && dbInfo.isProduction) {
    return "🔴 PRODUCTION";
  } else if (nodeEnv === "production") {
    return "🟡 PRODUCTION (local db)";
  } else if (dbInfo.isLocal) {
    return "🟢 DEVELOPMENT";
  } else {
    return "🟡 DEVELOPMENT (remote db)";
  }
}
