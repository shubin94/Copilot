/**
 * Create a new admin user (or upgrade existing user to admin and set password).
 * Does NOT delete any existing users.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=YourPassword npx tsx scripts/create-admin.ts
 *
 * If ADMIN_EMAIL / ADMIN_PASSWORD are not set, defaults are used and printed.
 */

import "dotenv/config";
import { db } from "../db/index.ts";
import { users } from "../shared/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

async function run() {
  const email = (process.env.ADMIN_EMAIL || "admin@askdetectives.com").toLowerCase().trim();
  const plainPassword = process.env.ADMIN_PASSWORD || "Admin123!";

  if (!email) {
    console.error("ADMIN_EMAIL is required (or use default).");
    process.exit(1);
  }
  if (!plainPassword || plainPassword.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
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
