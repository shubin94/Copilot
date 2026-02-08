import "./server/lib/loadEnv.ts"
import { db } from "./db/index.ts"
import { detectives } from "./shared/schema.ts"

async function listAllDetectives() {
  try {
    const allDetectives = await db.select().from(detectives)
    console.log(`\nTotal detectives in database: ${allDetectives.length}\n`)
    
    if (allDetectives.length === 0) {
      console.log("No detectives found.")
    } else {
      allDetectives.forEach((detective, index) => {
        console.log(`Detective ${index + 1}:`)
        console.log(`  ID: ${detective.id}`)
        console.log(`  User ID: ${detective.userId}`)
        console.log(`  Business Name: ${detective.businessName}`)
        console.log(`  Contact Email: ${detective.contactEmail}`)
        console.log(`  Years Experience: ${detective.yearsExperience || 'N/A'}`)
        console.log(`  Country: ${detective.country || 'N/A'}`)
        console.log(`  Bio: ${detective.bio ? (detective.bio.length > 80 ? detective.bio.substring(0, 80) + '...' : detective.bio) : 'N/A'}`)
        console.log(`  Logo: ${detective.logo || 'N/A'}`)
        console.log(`  Status: ${detective.status}`)
        console.log(`  Created at: ${detective.createdAt}`)
        console.log()
      })
    }
    process.exit(0)
  } catch (e) {
    console.error("Error:", e)
    process.exit(1)
  }
}

listAllDetectives()
