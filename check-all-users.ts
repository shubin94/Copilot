import { db } from "./db/index.ts"
import { users } from "./shared/schema.ts"

async function checkAll() {
  try {
    const allUsers = await db.select().from(users)
    console.log("All users in database:")
    allUsers.forEach(user => {
      console.log(`  Email: ${user.email}, Role: ${user.role}, Password hash: ${user.password.substring(0, 30)}...`)
    })
    process.exit(0)
  } catch (e) {
    console.error("Error:", e)
    process.exit(1)
  }
}

checkAll()
