import { storage } from "../server/storage.ts";

async function seedSiteSettings() {
  try {
    console.log("🌱 Seeding site settings with sample data...");

    const sampleData = {
      // 3 Logo URLs
      headerLogoUrl: "https://via.placeholder.com/200x60?text=Header+Logo",
      stickyHeaderLogoUrl: "https://via.placeholder.com/160x50?text=Sticky+Logo",
      footerLogoUrl: "https://via.placeholder.com/180x55?text=Footer+Logo",

      // Footer Sections with links
      footerSections: [
        {
          id: "categories",
          title: "Categories",
          order: 0,
          enabled: true,
          links: [
            {
              label: "Private Investigation",
              url: "/search?category=private-investigation",
              openInNewTab: false,
              enabled: true,
              order: 0,
            },
            {
              label: "Cyber Crime",
              url: "/search?category=cyber-crime",
              openInNewTab: false,
              enabled: true,
              order: 1,
            },
            {
              label: "Background Checks",
              url: "/search?category=background-checks",
              openInNewTab: false,
              enabled: true,
              order: 2,
            },
          ],
        },
        {
          id: "about",
          title: "About",
          order: 1,
          enabled: true,
          links: [
            {
              label: "About Us",
              url: "/about",
              openInNewTab: false,
              enabled: true,
              order: 0,
            },
            {
              label: "Careers",
              url: "/about#careers",
              openInNewTab: false,
              enabled: true,
              order: 1,
            },
            {
              label: "Press",
              url: "/about#press",
              openInNewTab: false,
              enabled: true,
              order: 2,
            },
          ],
        },
        {
          id: "support",
          title: "Support",
          order: 2,
          enabled: true,
          links: [
            {
              label: "Help Center",
              url: "/support",
              openInNewTab: false,
              enabled: true,
              order: 0,
            },
            {
              label: "Contact Us",
              url: "/contact",
              openInNewTab: false,
              enabled: true,
              order: 1,
            },
            {
              label: "Privacy Policy",
              url: "/privacy",
              openInNewTab: false,
              enabled: true,
              order: 2,
            },
          ],
        },
        {
          id: "community",
          title: "Community",
          order: 3,
          enabled: true,
          links: [
            {
              label: "Blog",
              url: "/blog",
              openInNewTab: false,
              enabled: true,
              order: 0,
            },
            {
              label: "Events",
              url: "/about#events",
              openInNewTab: false,
              enabled: true,
              order: 1,
            },
            {
              label: "Partners",
              url: "/about#partners",
              openInNewTab: false,
              enabled: true,
              order: 2,
            },
          ],
        },
        {
          id: "more",
          title: "More From Us",
          order: 4,
          enabled: true,
          links: [
            {
              label: "Mobile App",
              url: "https://apps.apple.com/app/finddetectives",
              openInNewTab: true,
              enabled: true,
              order: 0,
            },
            {
              label: "API Access",
              url: "/api-docs",
              openInNewTab: false,
              enabled: true,
              order: 1,
            },
            {
              label: "Affiliate Program",
              url: "/affiliate",
              openInNewTab: false,
              enabled: true,
              order: 2,
            },
          ],
        },
      ],

      // Social Media Links
      socialLinks: {
        facebook: "https://facebook.com/finddetectives",
        twitter: "https://twitter.com/finddetectives",
        linkedin: "https://linkedin.com/company/finddetectives",
        instagram: "https://instagram.com/finddetectives",
      },

      // Copyright Text
      copyrightText: "© FindDetectives International Ltd. 2025",
    };

    console.log("\n📝 Sample Data Structure:");
    console.log("- Header Logo:", sampleData.headerLogoUrl);
    console.log("- Sticky Logo:", sampleData.stickyHeaderLogoUrl);
    console.log("- Footer Logo:", sampleData.footerLogoUrl);
    console.log("- Footer Sections:", sampleData.footerSections.length);
    console.log("- Social Links:", Object.keys(sampleData.socialLinks).length);
    console.log("- Copyright:", sampleData.copyrightText);

    // Save using existing storage API
    const result = await storage.upsertSiteSettings(sampleData as any);

    console.log("\n✅ Site settings saved successfully!");
    console.log("\n📊 Saved Data:");
    console.log("ID:", result.id);
    console.log("Header Logo:", result.headerLogoUrl);
    console.log("Sticky Logo:", result.stickyHeaderLogoUrl);
    console.log("Footer Logo:", result.footerLogoUrl);
    console.log("Footer Sections Count:", (result.footerSections as any)?.length || 0);
    console.log("Social Links:", JSON.stringify(result.socialLinks, null, 2));
    console.log("Copyright:", result.copyrightText);
    console.log("Updated At:", result.updatedAt);

    console.log("\n✨ Sample data seeded successfully!");
    console.log("\n🔍 Verification Steps:");
    console.log("1. Visit http://localhost:5000/api/site-settings to check API response");
    console.log("2. Check header for header logo display");
    console.log("3. Check footer for all sections and social links");
    console.log("4. Visit /admin/settings to verify it's editable");
  } catch (error) {
    console.error("❌ Error seeding site settings:", error);
    throw error;
  }
}

seedSiteSettings()
  .then(() => {
    console.log("\n🎉 Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
