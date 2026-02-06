/**
 * Create a new admin user (or upgrade existing user to admin and set password).
 * Does NOT delete any existing users.
 *
 * SECURITY: Admin credentials must NEVER be hardcoded. This script requires
 * explicit environment variables to prevent accidental default admin creation.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=YourPassword npx tsx scripts/create-admin.ts
 *
 * ADMIN_EMAIL and ADMIN_PASSWORD MUST be set explicitly - no defaults are provided.
 */

import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { users } from "../shared/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

async function run() {
  // SECURITY: NO default credentials - must be explicitly provided
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const plainPassword = process.env.ADMIN_PASSWORD;

  if (!email) {
    console.error("ERROR: ADMIN_EMAIL environment variable is required.");
    console.error("Usage: ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=SecurePass123 npx tsx scripts/create-admin.ts");
    process.exit(1);
  }
  if (!plainPassword || plainPassword.length < 8) {
    console.error("ERROR: ADMIN_PASSWORD environment variable is required and must be at least 8 characters.");
    console.error("Usage: ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=SecurePass123 npx tsx scripts/create-admin.ts");
    process.exit(1);
  }

  try {
    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          password: hashedPassword,
          role: "admin",
          name: existing[0].name || "Admin",
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id));
      console.log("=== EXISTING USER UPDATED TO ADMIN ===");
      console.log(`Email: ${email}`);
      console.log(`Password and role have been updated. Use the password you set (ADMIN_PASSWORD) to log in.`);
      console.log("========================================");
    } else {
      await db.insert(users).values({
        email,
        password: hashedPassword,
        name: "Admin",
        role: "admin",
      });
      console.log("=== NEW ADMIN USER CREATED ===");
      console.log(`Email: ${email}`);
      console.log(`Password: ${plainPassword}`);
      console.log("Log in at /login with these credentials.");
      console.log("=================================");
    }
    process.exit(0);
  } catch (e) {
    console.error("Failed to create/update admin:", e);
    process.exit(1);
  }
}

run();
