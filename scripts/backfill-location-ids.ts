import "dotenv/config";
import { db as getDb } from "../db/index.ts";
import * as schema from "../shared/schema.ts";
import { eq, isNull, and } from "drizzle-orm";

const db = getDb;

async function backfillLocationIds() {
  try {
    console.log("✅ Backfilling location IDs...\n");
    console.log("ℹ️  Note: Location ID columns (city_id, state_id, country_id) need to be added to the schema first.");
    console.log("📝 To enable location backfilling, add these columns to the detectives table:");
    console.log("   - city_id (UUID, foreign key to cities.id)");
    console.log("   - state_id (UUID, foreign key to states.id)");
    console.log("   - country_id (UUID, foreign key to countries.id)");
    console.log("\n   Then update shared/schema.ts to include these fields in the detectives table.\n");

    // For now, this is a placeholder that verifies all detectives have slugs
    const allDetectives = await db.select().from(schema.detectives);
    const slugCount = allDetectives.filter((d) => d.slug).length;
    const noSlugCount = allDetectives.filter((d) => !d.slug).length;

    console.log(`✅ Detective slug status:`);
    console.log(`   - Detectives with slug: ${slugCount}`);
    console.log(`   - Detectives without slug: ${noSlugCount}`);

    if (noSlugCount > 0) {
      console.log(`\n⚠️  Run seed-slugs.ts again to fill remaining slugs`);
    }

    console.log(`\n✅ Slug seeding verification complete!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

backfillLocationIds();
