import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts"
import { users } from "./shared/schema.ts"

async function checkAll() {
  try {
    const allUsers = await db.select().from(users)
    console.log("All users in database:")
    const showPii = process.argv.includes("--show-pii")
    if (showPii) {
      console.warn("⚠️  PII logging enabled via --show-pii")
    }
    allUsers.forEach(user => {
      const emailOutput = showPii ? user.email : "[REDACTED for privacy]"
      console.log(`  Email: ${emailOutput}, Role: ${user.role}, Has Password: ${!!user.password}`)
    })
    process.exitCode = 0;
  } catch (e) {
    console.error("Error:", e)
    process.exitCode = 1;
  } finally {
    // Close the database connection
    process.exit(process.exitCode);
  }
}

checkAll()
