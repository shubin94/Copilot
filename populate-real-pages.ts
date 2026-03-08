import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

async function populateRealPages() {
  console.log("🗑️  Deleting test pages...");
  
  // Delete all existing test pages
  await pool.query("DELETE FROM pages");
  console.log("✅ Deleted all test pages");

  console.log("\n📁 Creating Static Pages category...");
  
  // Check if Static Pages category exists
  let categoryResult = await pool.query(
    "SELECT id FROM categories WHERE slug = $1",
    ["static-pages"]
  );
  
  let categoryId: string;
  if (categoryResult.rows.length > 0) {
    categoryId = categoryResult.rows[0].id;
    console.log("✅ Using existing Static Pages category");
  } else {
    // Create Static Pages category
    categoryResult = await pool.query(
      `INSERT INTO categories (name, slug, created_at, updated_at) 
       VALUES ($1, $2, NOW(), NOW()) 
       RETURNING id`,
      ["Static Pages", "static-pages"]
    );
    categoryId = categoryResult.rows[0].id;
    console.log("✅ Created Static Pages category");
  }

  console.log("\n📄 Creating real pages from sitemap...");

  const pages = [
    {
      title: "Find Private Detectives & Investigators Near You | AskDetectives.com",
      slug: "/",
      meta_title: "Find Private Detectives & Investigators Near You | AskDetectives.com",
      meta_description: "Connect with licensed private investigators and detective agencies across the United States. Search by location, specialty, and reviews to find the right investigator for your case.",
    },
    {
      title: "Search Private Detectives by Location & Specialty",
      slug: "search",
      meta_title: "Search Private Detectives by Location & Specialty | AskDetectives.com",
      meta_description: "Search and filter private detectives by location, specialty, ratings, and experience. Find the perfect investigator for your specific needs.",
    },
    {
      title: "Private Investigation Service Categories",
      slug: "categories",
      meta_title: "Private Investigation Service Categories | AskDetectives.com",
      meta_description: "Browse detective services by category including background checks, surveillance, missing persons, infidelity investigations, corporate investigations, and more.",
    },
    {
      title: "Private Detective Service Packages",
      slug: "packages",
      meta_title: "Private Detective Service Packages | AskDetectives.com",
      meta_description: "Explore service packages and pricing from private detectives. Compare investigation packages to find the best fit for your budget and needs.",
    },
    {
      title: "About AskDetectives.com",
      slug: "about",
      meta_title: "About AskDetectives.com - Your Trusted Private Detective Directory",
      meta_description: "Learn about AskDetectives.com, the leading directory for finding licensed private investigators and detective agencies across the United States.",
    },
    {
      title: "Contact Us",
      slug: "contact",
      meta_title: "Contact Us | AskDetectives.com",
      meta_description: "Get in touch with AskDetectives.com for questions, support, or partnership opportunities. We're here to help you find the right investigator.",
    },
    {
      title: "Customer Support",
      slug: "support",
      meta_title: "Customer Support | AskDetectives.com",
      meta_description: "Need help? Visit our support center for FAQs, guides, and assistance with finding and hiring private detectives.",
    },
    {
      title: "Privacy Policy",
      slug: "privacy",
      meta_title: "Privacy Policy | AskDetectives.com",
      meta_description: "Read our privacy policy to understand how AskDetectives.com collects, uses, and protects your personal information.",
    },
    {
      title: "Terms of Service",
      slug: "terms",
      meta_title: "Terms of Service | AskDetectives.com",
      meta_description: "Review the terms of service for using AskDetectives.com, including user responsibilities and service limitations.",
    }
  ];

  for (const page of pages) {
    const result = await pool.query(
      `INSERT INTO pages (
        title, slug, category_id, meta_title, meta_description, 
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, title, slug`,
      [
        page.title,
        page.slug,
          categoryId,
        page.meta_title,
        page.meta_description,
        'published'
      ]
    );
    console.log(`✅ Created: ${result.rows[0].title} (${result.rows[0].slug})`);
  }

  console.log("\n✅ Successfully populated all real pages from sitemap!");
  
  // Verify the pages
  console.log("\n📊 Final page count:");
  const countResult = await pool.query("SELECT COUNT(*) as count FROM pages WHERE status = 'published'");
  console.log(`Total published pages: ${countResult.rows[0].count}`);

  await pool.end();
}

populateRealPages().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
