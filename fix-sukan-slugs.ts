import pkg from "pg";
const { Pool } = pkg;

/**
 * Populate missing slugs for detectives and services
 * Particularly useful for newly added detectives without slugs
 */
async function populateAllSlugs() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Starting slug population for detectives and services...\n");

    // Function to generate slug (matches server logic)
    const generateSlug = (text: string): string => {
      if (!text) return "slug-" + Date.now();
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // Remove special chars
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
    };

    // ===== POPULATE DETECTIVE SLUGS =====
    console.log("📍 Checking detectives...");
    const detectivesResult = await pool.query(
      "SELECT id, business_name, city FROM detectives WHERE slug IS NULL"
    );

    const detectivesWithoutSlugs = detectivesResult.rows;
    console.log(`Found ${detectivesWithoutSlugs.length} detectives with missing slugs\n`);

    for (const detective of detectivesWithoutSlugs) {
      const businessName = detective.business_name || "detective";
      const city = detective.city || "";
      const slugText = city ? `${businessName} ${city}` : businessName;
      let slug = generateSlug(slugText);
      
      // Check for duplicates and append suffix if needed
      let suffix = 1;
      let finalSlug = slug;
      while (true) {
        const existing = await pool.query(
          "SELECT id FROM detectives WHERE slug = $1 AND id != $2",
          [finalSlug, detective.id]
        );
        if (existing.rows.length === 0) break;
        finalSlug = `${slug}-${suffix}`;
        suffix++;
      }

      await pool.query(
        "UPDATE detectives SET slug = $1 WHERE id = $2",
        [finalSlug, detective.id]
      );

      console.log(`  ✅ Detective ${detective.business_name} → ${finalSlug}`);
    }

    // ===== POPULATE SERVICE SLUGS =====
    console.log("\n📍 Checking services...");
    const servicesResult = await pool.query(
      "SELECT id, title, detective_id FROM services WHERE slug IS NULL"
    );

    const servicesWithoutSlugs = servicesResult.rows;
    console.log(`Found ${servicesWithoutSlugs.length} services with missing slugs\n`);

    for (const service of servicesWithoutSlugs) {
      const title = service.title || "service";
      let slug = generateSlug(title);

      // Check for duplicates within the same detective and append suffix if needed
      let suffix = 1;
      let finalSlug = slug;
      while (true) {
        const existing = await pool.query(
          "SELECT id FROM services WHERE slug = $1 AND detective_id = $2 AND id != $3",
          [finalSlug, service.detective_id, service.id]
        );
        if (existing.rows.length === 0) break;
        finalSlug = `${slug}-${suffix}`;
        suffix++;
      }

      await pool.query(
        "UPDATE services SET slug = $1 WHERE id = $2",
        [finalSlug, service.id]
      );

      console.log(`  ✅ Service "${service.title}" → ${finalSlug}`);
    }

    // ===== SUMMARY =====
    console.log("\n" + "=".repeat(60));
    console.log("✅ Slug population complete!");
    console.log(`   Detectives updated: ${detectivesWithoutSlugs.length}`);
    console.log(`   Services updated: ${servicesWithoutSlugs.length}`);
    console.log("=".repeat(60));

    await pool.end();
  } catch (error) {
    console.error("❌ Error populating slugs:", error);
    await pool.end();
    throw error;
  }
}

// Run the script
populateAllSlugs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
