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
        console.log(`  Name: ${detective.name}`)
        console.log(`  Email: ${detective.email}`)
        console.log(`  Specialties: ${detective.specialties || 'N/A'}`)
        console.log(`  Experience: ${detective.experience || 'N/A'}`)
        console.log(`  Location: ${detective.location || 'N/A'}`)
        console.log(`  Bio: ${detective.bio ? detective.bio.substring(0, 80) + '...' : 'N/A'}`)
        console.log(`  Avatar URL: ${detective.avatarUrl || 'N/A'}`)
        console.log(`  Verified: ${detective.isVerified}`)
        console.log(`  Active: ${detective.isActive}`)
        console.log(`  Rating: ${detective.rating || 0}`)
        console.log(`  Reviews Count: ${detective.reviewCount || 0}`)
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
