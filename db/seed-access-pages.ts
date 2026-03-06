import "../server/lib/loadEnv.ts";
import { db } from "./index.js";
import { accessPages } from "../shared/schema.js";
import { eq } from "drizzle-orm";

/**
 * Seed script to populate access_pages with initial data
 * 
 * Creates master list of pages that can be restricted by the access control system
 * These are the available pages that admins can grant/revoke for employee accounts
 */
async function seedAccessPages() {
  console.log("🌱 Starting access pages seed...");

  const pagesData = [
    {
      key: "dashboard",
      name: "Dashboard",
    },
    {
      key: "employees",
      name: "Employees Management",
    },
    {
      key: "detectives",
      name: "Detectives Management",
    },
    {
      key: "services",
      name: "Services Management",
    },
    {
      key: "users",
      name: "Users Management",
    },
    {
      key: "settings",
      name: "Settings",
    },
    {
      key: "reports",
      name: "Reports",
    },
    {
      key: "payments",
      name: "Payments & Finance",
    },
    {
      key: "cms",
      name: "Content Management System",
    },
  ];

  try {
    for (const pageData of pagesData) {
      // Check if page already exists
      const existing = await db.query.accessPages.findFirst({
        where: eq(accessPages.key, pageData.key),
      });

      if (existing) {
        console.log(`✅ Page "${pageData.name}" already exists (id: ${existing.id})`);
      } else {
        // Insert new page
        const result = await db.insert(accessPages).values(pageData).returning();
        console.log(`✨ Created page "${pageData.name}" (id: ${result[0]?.id})`);
      }
    }

    console.log("\n✅ Access pages seeding completed successfully!");
    console.log(`📊 Total pages configured: ${pagesData.length}`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

export default seedAccessPages;

// Run if executed directly (Node.js compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAccessPages()
    .then(() => {
      console.log("\n✅ Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Seed failed:", error);
      process.exit(1);
    });
}
