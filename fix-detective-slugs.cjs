const pg = require('pg');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
});

function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Remove multiple hyphens
    .replace(/^-+|-+$/g, '');       // Remove leading/trailing hyphens
}

async function fixDetectiveSlugs() {
  try {
    await client.connect();
    
    console.log("📋 Fetching all detectives...\n");
    
    const result = await client.query(
      `SELECT id, business_name, slug FROM detectives ORDER BY created_at DESC`
    );

    if (result.rows.length === 0) {
      console.log("❌ No detectives found");
      await client.end();
      process.exit(1);
    }

    console.log(`Found ${result.rows.length} detectives. Generating proper slugs...\n`);

    for (const detective of result.rows) {
      const newSlug = generateSlug(detective.business_name);
      
      console.log(`Updating: "${detective.business_name}"`);
      console.log(`  Old slug: ${detective.slug}`);
      console.log(`  New slug: ${newSlug}`);
      
      await client.query(
        `UPDATE detectives SET slug = $1 WHERE id = $2`,
        [newSlug, detective.id]
      );
      
      console.log(`  ✅ Updated\n`);
    }

    console.log("✅ All detective slugs updated!\n");
    
    // Show the new URLs
    console.log("📍 New Detective URLs:\n");
    const updatedResult = await client.query(
      `SELECT business_name, slug, country, state, city FROM detectives ORDER BY created_at DESC`
    );
    
    updatedResult.rows.forEach((det, idx) => {
      const url = `http://localhost:5000/detectives/${det.country}/${det.state}/${det.city}/${det.slug}/`;
      console.log(`${idx + 1}. ${det.business_name}`);
      console.log(`   ${url}\n`);
    });

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

fixDetectiveSlugs();
