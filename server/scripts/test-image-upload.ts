import { db } from "../../db/index.ts";
import { siteSettings } from "../../shared/schema.ts";
import { eq } from "drizzle-orm";

async function testImageUpload() {
  console.log("Testing image upload to database...");

  try {
    // Test with a public image URL
    const testHeroUrl = "https://picsum.photos/1920/600";
    const testFeaturesUrl = "https://picsum.photos/800/600";

    const [settings] = await db.select().from(siteSettings).limit(1);

    if (settings) {
      const result = await db.update(siteSettings)
        .set({
          heroBackgroundImage: testHeroUrl,
          featuresImage: testFeaturesUrl,
          updatedAt: new Date()
        })
        .where(eq(siteSettings.id, settings.id))
        .returning();

      console.log("✓ Successfully updated:");
      console.log("  Hero:", result[0].heroBackgroundImage);
      console.log("  Features:", result[0].featuresImage);
      console.log("\nNow refresh your browser (Ctrl+Shift+R) to see the new images!");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
}

testImageUpload();
