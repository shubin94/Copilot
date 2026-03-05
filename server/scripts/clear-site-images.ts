import { db } from "../../db/index.js";
import { siteSettings } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

async function clearSiteImages() {
  const [settings] = await db.select().from(siteSettings).limit(1);
  if (!settings) {
    console.log("No site settings row found.");
    process.exit(0);
  }
  await db.update(siteSettings)
    .set({
      heroBackgroundImage: null,
      featuresImage: null,
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.id, settings.id));

  console.log("Cleared heroBackgroundImage and featuresImage.");
  process.exit(0);
}

clearSiteImages().catch((err) => {
  console.error(err);
  process.exit(1);
});
