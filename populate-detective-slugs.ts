import pkg from "pg";
const { Pool } = pkg;

/**
 * Populate missing detective slugs
 * Generates slugs from business_name for all records where slug is NULL
 */
async function populateDetectiveSlugs() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Starting detective slug population...");

    // Function to generate slug (matches server logic)
    const generateSlug = (text: string): string => {
      if (!text) return "detective-" + Date.now();
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // Remove special chars
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
    };

    // Get all detectives with NULL slugs
    const result = await pool.query(
      "SELECT id, business_name, city FROM detectives WHERE slug IS NULL LIMIT 100"
    );

    const detectivesWithoutSlugs = result.rows;
    console.log(`Found ${detectivesWithoutSlugs.length} detectives with missing slugs`);

    if (detectivesWithoutSlugs.length === 0) {
      console.log("✅ All detectives already have slugs!");
      await pool.end();
      return;
    }

    // Update each detective with generated slug
    for (const detective of detectivesWithoutSlugs) {
      const businessName = detective.business_name || "detective";
      const city = detective.city || "";
      const slugText = city ? `${businessName} ${city}` : businessName;
      const slug = generateSlug(slugText);

      await pool.query(
        "UPDATE detectives SET slug = $1 WHERE id = $2 AND slug IS NULL",
        [slug, detective.id]
      );

      console.log(`✅ Detective ${detective.id}: ${businessName} → ${slug}`);
    }

    // Check if there are more detectives with missing slugs
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM detectives WHERE slug IS NULL"
    );

    const remaining = parseInt(countResult.rows[0].count);
    if (remaining > 0) {
      console.log(`\n⚠️  Still ${remaining} detectives with missing slugs. Running again...`);
      // Close pool and recall the function
      await pool.end();
      await populateDetectiveSlugs();
    } else {
      console.log("✅ All detectives now have slugs!");
      await pool.end();
    }
  } catch (error) {
    console.error("❌ Error populating detective slugs:", error);
    await pool.end();
    throw error;
  }
}

// Run the script
populateDetectiveSlugs()
  .then(() => {
    console.log("✅ Migration complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
