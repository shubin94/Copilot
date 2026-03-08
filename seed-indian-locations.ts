/**
 * Quick seed script for Indian states and cities
 * Targets the specific locations used by local detectives
 * 
 * Run with: npx tsx seed-indian-locations.ts
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Load environment variables FIRST, before importing db
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

import { db, pool } from "./db/index.ts";
import { countries, states, cities } from "./shared/schema.ts";
import { eq, sql } from "drizzle-orm";

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

async function seedIndianLocations() {
  console.log("\n🇮🇳 Seeding Indian States and Cities\n");
  
  try {
    // STEP 1: Ensure updated_at columns exist (schema migration)
    console.log("🔧 Adding missing updated_at columns if needed...");
    await db.execute(sql`ALTER TABLE countries ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL`);
    await db.execute(sql`ALTER TABLE states ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL`);
    await db.execute(sql`ALTER TABLE cities ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL`);
    console.log("   ✓ Database schema updated\n");
    
    // Get or create India (select only columns that exist)
    let india = await db
      .select({
        id: countries.id,
        code: countries.code,
        name: countries.name,
      })
      .from(countries)
      .where(eq(countries.code, "IN"))
      .limit(1);
    let indiaId: number;

    if (india.length === 0) {
      console.log("📍 Creating India...");
      const inserted = await db.insert(countries).values({
        code: "IN",
        name: "India",
        slug: "india",
      }).returning({ id: countries.id });
      indiaId = inserted[0].id;
      console.log(`   ✓ India created (ID: ${indiaId})\n`);
    } else {
      indiaId = india[0].id;
      console.log(`   ✓ India found (ID: ${indiaId})\n`);
    }

    // USA for Arizona
    let usa = await db
      .select({
        id: countries.id,
        code: countries.code,
        name: countries.name,
      })
      .from(countries)
      .where(eq(countries.code, "US"))
      .limit(1);
    let usaId: number;

    if (usa.length === 0) {
      console.log("📍 Creating USA...");
      const inserted = await db.insert(countries).values({
        code: "US",
        name: "United States",
        slug: "united-states",
      }).returning({ id: countries.id });
      usaId = inserted[0].id;
      console.log(`   ✓ USA created (ID: ${usaId})\n`);
    } else {
      usaId = usa[0].id;
      console.log(`   ✓ USA found (ID: ${usaId})\n`);
    }

    // Seed Indian states needed by detectives
    const indianStates = [
      { name: "Assam", countryId: indiaId },
      { name: "Kerala", countryId: indiaId },
      { name: "Arunachal Pradesh", countryId: indiaId },
      { name: "Karnataka", countryId: indiaId },
      { name: "Maharashtra", countryId: indiaId },
      { name: "Delhi", countryId: indiaId },
      { name: "Tamil Nadu", countryId: indiaId },
      { name: "West Bengal", countryId: indiaId },
      { name: "Uttar Pradesh", countryId: indiaId },
      { name: "Gujarat", countryId: indiaId },
    ];

    const usStates = [
      { name: "Arizona", countryId: usaId },
      { name: "California", countryId: usaId },
      { name: "Texas", countryId: usaId },
      { name: "New York", countryId: usaId },
    ];

    const allStates = [...indianStates, ...usStates];
    const stateIdMap = new Map<string, number>();

    console.log("🏙️  Seeding states...");
    for (const stateData of allStates) {
      const slug = generateSlug(stateData.name);
      
      // Check if exists
      const existing = await db
        .select({
          id: states.id,
          name: states.name,
        })
        .from(states)
        .where(eq(states.slug, slug))
        .limit(1);

      let stateId: number;
      if (existing.length === 0) {
        const inserted = await db.insert(states).values({
          countryId: stateData.countryId,
          name: stateData.name,
          slug: slug,
        }).returning({ id: states.id });
        stateId = inserted[0].id;
        console.log(`   ✓ ${stateData.name} (ID: ${stateId})`);
      } else {
        stateId = existing[0].id;
        console.log(`   → ${stateData.name} (exists, ID: ${stateId})`);
      }
      
      stateIdMap.set(stateData.name, stateId);
    }

    // Seed cities for each state
    const cityData: { [state: string]: string[] } = {
      "Assam": ["Guwahati", "Dibrugarh", "Jorhat", "Silchar", "Tezpur"],
      "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"],
      "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang"],
      "Karnataka": ["Bengaluru", "Mysore", "Mangalore", "Hubli", "Belgaum"],
      "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"],
      "Delhi": ["New Delhi", "Delhi"],
      "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
      "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri"],
      "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut"],
      "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
      "Arizona": ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale"],
      "California": ["Los Angeles", "San Francisco", "San Diego", "San Jose"],
      "Texas": ["Houston", "Dallas", "Austin", "San Antonio"],
      "New York": ["New York City", "Buffalo", "Rochester", "Albany"],
    };

    console.log("\n🌆 Seeding cities...");
    let cityCount = 0;
    
    for (const [stateName, cityNames] of Object.entries(cityData)) {
      const stateId = stateIdMap.get(stateName);
      if (!stateId) {
        console.log(`   ⚠️  State not found: ${stateName}`);
        continue;
      }

      for (const cityName of cityNames) {
        const slug = generateSlug(cityName);
        
        // Check if exists
        const existing = await db
          .select({
            id: cities.id,
            name: cities.name,
          })
          .from(cities)
          .where(eq(cities.slug, slug))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(cities).values({
            stateId: stateId,
            name: cityName,
            slug: slug,
          });
          cityCount++;
        }
      }
      console.log(`   ✓ ${stateName}: ${cityNames.length} cities`);
    }

    // Verify
    console.log("\n✅ Verification:");
    const countryCount = await db.select({ id: countries.id }).from(countries);
    const stateCount = await db.select({ id: states.id }).from(states);
    const cityCountResult = await db.select({ id: cities.id }).from(cities);

    console.log(`   Countries: ${countryCount.length}`);
    console.log(`   States: ${stateCount.length}`);
    console.log(`   Cities: ${cityCountResult.length}`);

    console.log("\n✅ Seeding complete!");
    console.log("\n💡 Next step: Run the migration to link detectives:");
    console.log("   npm run migrate:populate-location-fks -- --apply\n");

  } catch (error) {
    console.error("❌ Error seeding locations:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedIndianLocations();
