import { sql, eq } from "drizzle-orm";
import { db } from "./db/index.ts";
import { detectives, countries, states, cities } from "./shared/schema.ts";

async function findLynx() {
  try {
    // Find detective named "Lynx"
    const result = await db
      .select({
        id: detectives.id,
        businessName: detectives.businessName,
        slug: detectives.slug,
        country: detectives.country,
        state: detectives.state,
        city: detectives.city,
      })
      .from(detectives)
      .where(
        sql`LOWER(${detectives.businessName}) LIKE LOWER('%Lynx%')`
      )
      .limit(1);

    if (result.length === 0) {
      console.log("❌ No detective named Lynx found");
      process.exit(1);
    }

    const detective = result[0];
    console.log("✅ Found detective:", detective);

    // Get country slug
    const countryData = await db
      .select({ slug: countries.slug })
      .from(countries)
      .where(eq(countries.code, detective.country))
      .limit(1);

    // Get state slug
    const stateData = await db
      .select({ slug: states.slug })
      .from(states)
      .where(eq(states.name, detective.state))
      .limit(1);

    // Get city slug
    const cityData = await db
      .select({ slug: cities.slug })
      .from(cities)
      .where(eq(cities.name, detective.city))
      .limit(1);

    const countrySlug = countryData[0]?.slug || detective.country.toLowerCase();
    const stateSlug = stateData[0]?.slug || detective.state.toLowerCase();
    const citySlug = cityData[0]?.slug || detective.city.toLowerCase();
    const businessSlug = detective.slug || detective.businessName.toLowerCase().replace(/\s+/g, "-");

    const url = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/${businessSlug}/`;
    
    console.log("\n📍 Detective Profile URL:");
    console.log(url);
    
    console.log("\n📋 Details:");
    console.log(`  Business: ${detective.businessName}`);
    console.log(`  Location: ${detective.city}, ${detective.state}, ${detective.country}`);
    console.log(`  Slug: ${businessSlug}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
  
  process.exit(0);
}


