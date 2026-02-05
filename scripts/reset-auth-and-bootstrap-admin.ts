/**
 * EMERGENCY ADMIN RESET SCRIPT
 * 
 * SECURITY WARNING: This script DELETES ALL USERS and creates a new admin.
 * Use ONLY for:
 * - Initial setup
 * - Emergency admin account recovery
 * - Development environment resets
 * 
 * DO NOT run this in production with existing users!
 * 
 * Safety Features:
 * - Blocks execution on production databases unless explicitly allowed
 * - Requires confirmation for non-local databases
 * - Shows which database will be modified before proceeding
 * - Admin credentials must NEVER be hardcoded (generated randomly)
 */

import "../server/lib/loadEnv";
import { users, session, profileClaims } from "../shared/schema.ts"
import { validateDatabaseForOperation, parseDatabaseUrl } from "../db/validateDatabase.ts"
import bcrypt from "bcrypt"
import { nanoid } from "nanoid"

async function run() {
  // Dynamic import db AFTER environment is loaded to avoid import-time DATABASE_URL check
  const { db } = await import("../db/index.ts")
  try {
    // STEP 1: Validate database safety
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      console.error("❌ DATABASE_URL environment variable not set")
      process.exit(1)
    }

    console.log("\n🔐 ADMIN RESET - Security Check")
    console.log("=" .repeat(50))

    // Check database before proceeding
    const dbValidation = await validateDatabaseForOperation(
      dbUrl,
      "DESTRUCTIVE: Delete all users and create new admin",
      {
        allowProduction: process.env.ALLOW_PRODUCTION_RESET === "true",
        requireConfirmation: process.env.SKIP_CONFIRMATION !== "true",
        nodeEnv: process.env.NODE_ENV,
      }
    )

    if (!dbValidation.allowed) {
      console.error(`❌ Operation blocked: ${dbValidation.reason}`)
      process.exit(1)
    }

    console.log("✅ Database validation passed. Proceeding...\n")

    // STEP 2: Generate or use provided credentials
    const adminEmail = process.env.ADMIN_EMAIL || `superadmin+${nanoid(8)}@example.com`
    const securePassword = process.env.ADMIN_PASSWORD || `${nanoid(16)}${nanoid(16).toUpperCase()}!#`
    const hashed = await bcrypt.hash(securePassword, 10)

    console.log("🗑️  Deleting existing users and session data...")

    // Delete in order of foreign key dependencies
    // 1. Delete profile_claims first (references users and detectives)
    await db.delete(profileClaims)
    
    // 2. Then delete all sessions and users
    await db.delete(session)
    await db.delete(users)

    console.log("✅ Existing data cleared\n")

    // STEP 3: Create new admin
    console.log("👤 Creating new super admin...")
    const [admin] = await db.insert(users).values({
      email: adminEmail.toLowerCase().trim(),
      password: hashed,
      name: "Super Admin",
      role: "admin",
      googleId: null,
    }).returning()

    console.log("\n" + "=" .repeat(50))
    console.log("✅ SUPER ADMIN CREATED SUCCESSFULLY")
    console.log("=" .repeat(50))
    console.log(`Email:    ${adminEmail}`)
    console.log(`Password: ${securePassword}`)
    console.log("\nℹ️  Store these credentials securely.")
    console.log("ℹ️  Password is hashed in database.")
    console.log("=" .repeat(50) + "\n")

    process.exit(0)
  } catch (e) {
    console.error("\n❌ Failed to reset auth and bootstrap admin:")
    console.error(e instanceof Error ? e.stack : String(e))
    process.exit(1)
  }
}

run()

