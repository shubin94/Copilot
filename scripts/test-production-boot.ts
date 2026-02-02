/**
 * Test production boot locally
 * This script temporarily renames .env to .env.backup and uses .env.production.test
 */
import { execSync } from "child_process";
import { existsSync, renameSync } from "fs";
import { join } from "path";

const rootDir = join(import.meta.dirname, "..");
const envFile = join(rootDir, ".env");
const envBackup = join(rootDir, ".env.backup");
const envProdTest = join(rootDir, ".env.production.test");

console.log("🧪 Testing production boot...\n");

// Backup existing .env
if (existsSync(envFile)) {
  console.log("📦 Backing up .env to .env.backup");
  renameSync(envFile, envBackup);
}

// Copy production test env
if (existsSync(envProdTest)) {
  console.log("📝 Using .env.production.test\n");
  renameSync(envProdTest, envFile);
}

try {
  console.log("🚀 Starting production server...\n");
  execSync("npm run start", { stdio: "inherit", cwd: rootDir });
} catch (error) {
  console.error("\n❌ Production boot failed");
  process.exit(1);
} finally {
  // Restore original .env
  if (existsSync(envFile)) {
    renameSync(envFile, envProdTest);
  }
  if (existsSync(envBackup)) {
    console.log("\n📦 Restoring original .env");
    renameSync(envBackup, envFile);
  }
}
