/**
 * One-time fix: set admin@example.com password to a bcrypt hash.
 * Run: npx tsx scripts/fix-admin-password.ts
 * Then log in with email: admin@example.com, password: AKsukan1234
 */
import "dotenv/config";
import { db } from "../db/index.ts";
import { users } from "../shared/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const ADMIN_EMAIL = "admin@example.com";
const NEW_PASSWORD = "AKsukan1234";

async function run() {
  const hashed = await bcrypt.hash(NEW_PASSWORD, 10);
  const result = await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.email, ADMIN_EMAIL))
    .returning({ id: users.id, email: users.email });

  if (result.length === 0) {
    console.error(`No user found with email "${ADMIN_EMAIL}". Create one first or use a different email.`);
    process.exit(1);
  }
  console.log(`Password updated for ${ADMIN_EMAIL}. You can now log in with password: ${NEW_PASSWORD}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
