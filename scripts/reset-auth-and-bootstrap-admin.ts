import { db } from "../db/index.ts"
import { users, session, profileClaims } from "../shared/schema.ts"
import bcrypt from "bcrypt"
import { nanoid } from "nanoid"

async function run() {
  try {
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
