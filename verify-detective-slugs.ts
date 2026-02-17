/**
 * Direct database validation - count detectives with slugs
 * Run with: DATABASE_URL="..." npx tsx verify-detective-slugs.ts
 */

import pkg from "pg";
const { Pool } = pkg;

async function verifyDetectiveSlugs() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔍 Verifying detective slugs in database...\n");

    // Get total count
    const totalResult = await pool.query("SELECT COUNT(*) as total FROM detectives");
    const totalDetectives = totalResult.rows[0].total;

    // Get count with slugs
    const withSlugsResult = await pool.query("SELECT COUNT(*) as count FROM detectives WHERE slug IS NOT NULL");
    const withSlugs = withSlugsResult.rows[0].count;

    // Get count without slugs
    const withoutSlugsResult = await pool.query("SELECT COUNT(*) as count FROM detectives WHERE slug IS NULL");
    const withoutSlugs = withoutSlugsResult.rows[0].count;

    console.log(`📊 Detective Statistics:`);
    console.log(`   Total detectives: ${totalDetectives}`);
    console.log(`   With slugs: ${withSlugs} ✅`);
    console.log(`   Missing slugs: ${withoutSlugs} ${withoutSlugs > 0 ? "❌" : ""}`);

    if (withoutSlugs > 0) {
      console.log(`\n🔴 Found ${withoutSlugs} detectives missing slugs. Fetching sample:`);
      const sampleResult = await pool.query(
        "SELECT id, business_name, city FROM detectives WHERE slug IS NULL LIMIT 5"
      );
      sampleResult.rows.forEach((d: any, i: number) => {
        console.log(`   [${i + 1}] ${d.business_name} (${d.city})`);
      });
    } else {
      console.log(`\n✅ ALL detectives have slugs!`);
    }

    // Sample detective with slug
    const sampleWithSlug = await pool.query(
      "SELECT id, business_name, slug, country, state, city FROM detectives WHERE slug IS NOT NULL LIMIT 1"
    );
    
    if (sampleWithSlug.rows.length > 0) {
      const d = sampleWithSlug.rows[0];
      console.log(`\n📝 Sample detective URL:`);
      console.log(`   /detectives/${d.country}/${d.state}/${d.city}/${d.slug}/`);
      console.log(`   Name: ${d.business_name}`);
    }

    console.log(`\n✅ Verification complete!`);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyDetectiveSlugs();
