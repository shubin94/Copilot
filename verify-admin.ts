import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts"
import { users } from "./shared/schema.ts"
import { eq } from "drizzle-orm"

async function verify() {
  try {
    const admin = await db.select().from(users).where(eq(users.role, 'admin'))
    if (admin.length > 0) {
      console.log("✓ Admin user exists in database:")
      console.log(`  Email: ${admin[0].email}`)
      console.log(`  Name: ${admin[0].name}`)
      console.log(`  Role: ${admin[0].role}`)
      console.log(`  Has Password: ${!!admin[0].password}`)
    } else {
      console.log("✗ No admin user found in database")
    }
  } catch (e) {
    console.error("Error verifying admin:", e)
    process.exitCode = 1;
  }
}

verify().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
