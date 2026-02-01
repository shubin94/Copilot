/**
 * EMERGENCY ADMIN RESET SCRIPT
 * 
 * SECURITY WARNING: This script DELETES ALL USERS and creates a new admin.
 * Use ONLY for:
 * - Initial setup
 * - Emergency admin account recovery
 * - Development environment resets
 * 
 * Admin credentials must NEVER be hardcoded. This script generates random
 * credentials or uses environment variables (ADMIN_EMAIL, ADMIN_PASSWORD).
 * 
 * DO NOT run this in production with existing users!
 */

import { db } from "../db/index.ts"
import { users, session, profileClaims } from "../shared/schema.ts"
import bcrypt from "bcrypt"
import { nanoid } from "nanoid"

async function run() {
  try {
    // SECURITY: Generate random credentials if not provided via environment
    const adminEmail = process.env.ADMIN_EMAIL || `superadmin+${nanoid(8)}@example.com`
    const securePassword = process.env.ADMIN_PASSWORD || `${nanoid(16)}${nanoid(16).toUpperCase()}!#`
    const hashed = await bcrypt.hash(securePassword, 10)

    // Delete in order of foreign key dependencies
    // 1. Delete profile_claims first (references users and detectives)
    await db.delete(profileClaims)
    
    // 2. Then delete all sessions and users
    await db.delete(session)
    await db.delete(users)

    const [admin] = await db.insert(users).values({
      email: adminEmail.toLowerCase().trim(),
      password: hashed,
      name: "Super Admin",
      role: "admin",
      googleId: null,
    }).returning()

    console.log("=== SUPER ADMIN CREATED ===")
    console.log(`Email: ${adminEmail}`)
    console.log(`Password: ${securePassword}`)
    console.log("Credentials are stored in the database (hashed).")
    console.log("===========================")
    process.exit(0)
  } catch (e) {
    console.error("Failed to reset auth and bootstrap admin:", e)
    process.exit(1)
  }
}

run()
