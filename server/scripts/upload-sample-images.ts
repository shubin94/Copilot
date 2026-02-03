import { db } from "../../db/index.ts";
import { siteSettings } from "../../shared/schema.ts";
import { eq } from "drizzle-orm";

async function uploadSampleImages() {
  console.log("Uploading sample images to site_settings...");

  try {
    // Sample image URLs - using placeholder images
    const heroBackgroundUrl = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&h=600&fit=crop";
    const featuresImageUrl = "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop";

    // Get the current site settings
    const [settings] = await db.select().from(siteSettings).limit(1);

    if (settings) {
      // Update existing settings
      await db.update(siteSettings)
        .set({
          heroBackgroundImage: heroBackgroundUrl,
          featuresImage: featuresImageUrl,
          updatedAt: new Date()
        })
        .where(eq(siteSettings.id, settings.id));

      console.log("✓ Updated site settings with sample images");
      console.log(`  Hero Background: ${heroBackgroundUrl}`);
      console.log(`  Features Image: ${featuresImageUrl}`);
    } else {
      // Insert new settings if none exist
      await db.insert(siteSettings).values({
        heroBackgroundImage: heroBackgroundUrl,
        featuresImage: featuresImageUrl,
        updatedAt: new Date()
      });

      console.log("✓ Created new site settings with sample images");
    }

    console.log("\nSample images uploaded successfully!");
    console.log("You can now view them on the home page.");
    console.log("Go to /admin/settings to change them to your own images.");
    
    process.exit(0);
  } catch (error) {
    console.error("Upload failed:", error);
    process.exit(1);
  }
}

uploadSampleImages();
