/**
 * site_settings must have at least one row for production.
 */
import { db } from "../db/index.ts";
import { siteSettings } from "../shared/schema.ts";

async function seedSiteSettings() {
  try {
    const existing = await db.select().from(siteSettings).limit(1);
    if (existing.length > 0) {
      console.log("✅ site_settings already populated. No changes made.");
      process.exit(0);
    }

    await db.insert(siteSettings).values({
      headerLogoUrl: null,
      stickyHeaderLogoUrl: null,
      footerLogoUrl: null,
      footerLinks: [],
      footerSections: [],
      socialLinks: {},
      copyrightText: "© AskDetectives",
    });

    console.log("✅ Inserted default site_settings row.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to seed site_settings:", error);
    process.exit(1);
  }
}

seedSiteSettings();
