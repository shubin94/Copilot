import "./server/lib/loadEnv.ts"
import { db } from "./db/index.ts"
import { users } from "./shared/schema.ts"

async function listAll() {
  try {
    const showPii = process.argv.includes('--show-pii')
    
    const allUsers = await db.select().from(users)
    console.log(`\nTotal users in database: ${allUsers.length}\n`)
    
    if (allUsers.length === 0) {
      console.log("No users found.")
    } else {
      allUsers.forEach((user, index) => {
        console.log(`User ${index + 1}:`)
        console.log(`  ID: ${user.id}`)
        console.log(`  Email: ${showPii ? user.email : '[REDACTED for privacy]'}`)
        console.log(`  Name: ${showPii ? user.name : '[REDACTED for privacy]'}`)
        console.log(`  Role: ${user.role}`)
        console.log(`  Has Password: ${!!user.password}`)
        console.log(`  Created at: ${user.createdAt}`)
        console.log()
      })
    }
    
    if (!showPii) {
      console.log("⚠️  PII is redacted. Use --show-pii flag to display email and name")
    }
    process.exitCode = 0
  } catch (e) {
    console.error("Error:", e)
    process.exitCode = 1
  } finally {
    process.exit(process.exitCode)
  }
}

listAll()
