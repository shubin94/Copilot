import { db } from "./db/index.ts"
import { users } from "./shared/schema.ts"

async function listAll() {
  try {
    const allUsers = await db.select().from(users)
    console.log(`\nTotal users in database: ${allUsers.length}\n`)
    
    if (allUsers.length === 0) {
      console.log("No users found.")
    } else {
      allUsers.forEach((user, index) => {
        console.log(`User ${index + 1}:`)
        console.log(`  ID: ${user.id}`)
        console.log(`  Email: ${user.email}`)
        console.log(`  Name: ${user.name}`)
        console.log(`  Role: ${user.role}`)
        console.log(`  Password hash: ${user.password.substring(0, 40)}...`)
        console.log(`  Created at: ${user.createdAt}`)
        console.log()
      })
    }
    process.exit(0)
  } catch (e) {
    console.error("Error:", e)
    process.exit(1)
  }
}

listAll()
