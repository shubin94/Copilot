import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { users, detectives, services } from "../shared/schema.ts";
import { eq, sql, desc } from "drizzle-orm";

async function run() {
  const email = "claimme@gmail.com";
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.log(`User not found: ${email}`);
    return;
  }
  const [detective] = await db.select().from(detectives).where(eq(detectives.userId, user.id)).limit(1);
  if (!detective) {
    console.log(`Detective profile not found for user: ${email}`);
    return;
  }
  const existing = await db.select().from(services).where(eq(services.detectiveId, detective.id)).orderBy(desc(services.createdAt));
  const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+z6aQAAAAASUVORK5CYII=";
  if (existing.length > 0) {
    const s = existing[0];
    const hasImage = Array.isArray(s.images) && s.images.length > 0;
    if (hasImage && s.isActive) {
      console.log(`Existing visible service found: ${s.id}`);
      return;
    }
    await db.update(services)
      .set({ images: hasImage ? s.images : sql`ARRAY[${img}]::text[]`, isActive: true, updatedAt: new Date() })
      .where(eq(services.id, s.id));
    console.log(`Updated service to be visible: ${s.id}`);
    return;
  }
  const categoryLabel = "Background Checks";
  const businessLabel = detective.businessName || "this detective";
  const [created] = await db.insert(services).values({
    detectiveId: detective.id,
    category: categoryLabel,
    title: `${categoryLabel} Services`,
    description: `Professional ${categoryLabel.toLowerCase()} services by ${businessLabel}. Contact for detailed consultation.`,
    images: sql`ARRAY[${img}]::text[]`,
    basePrice: "100.00",
    offerPrice: null,
    isActive: true,
  }).returning();
  console.log(`Created visible service: ${created.id}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
