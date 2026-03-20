/**
 * One-time fix script for "Yow Johnson Private Investigators"
 *
 * Problems:
 *  1. Auto-created services had no images → filtered out of service location pages
 *  2. Service slugs may have UUID prefix  → URL mismatch (already handled by backend REGEXP_REPLACE,
 *     but we also rewrite them here for clean URLs going forward)
 *
 * Run:  npx tsx fix-yow-johnson.ts
 */
import "./server/lib/loadEnv.js";
import { db } from "./db/index.ts";
import { detectives, services } from "./shared/schema.ts";
import { eq, ilike, sql } from "drizzle-orm";

function generateSlug(text: string): string {
  return text
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

async function run() {
  // ── 1. Find the detective ────────────────────────────────────────────────
  const rows = await db
    .select()
    .from(detectives)
    .where(ilike(detectives.businessName, "%yow johnson%"))
    .limit(5);

  if (rows.length === 0) {
    console.error("❌  Detective not found — no business name matching 'yow johnson'.");
    process.exit(1);
  }

  const detective = rows[0];
  console.log(`✅  Found detective: "${detective.businessName}" (id: ${detective.id}, slug: ${detective.slug})`);
  console.log(`    Status   : ${detective.status}`);
  console.log(`    Logo     : ${detective.logo ? detective.logo.substring(0, 80) + "…" : "NONE"}`);
  console.log(`    Banner   : ${(detective as any).defaultServiceBanner ? "present" : "none"}`);
  console.log(`    Location : ${detective.city}, ${detective.state}, ${detective.country}`);
  console.log(`    Location IDs: countryId=${detective.countryId}, stateId=${detective.stateId}, cityId=${detective.cityId}`);

  // ── 2. Ensure detective is active ────────────────────────────────────────
  if (detective.status !== "active") {
    await db.update(detectives)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(detectives.id, detective.id));
    console.log(`🔧  Detective status updated → active`);
  }

  // ── 3. Determine the fallback image ─────────────────────────────────────
  const fallbackImage: string | undefined =
    ((detective as any).defaultServiceBanner as string | undefined) ||
    (detective.logo as string | undefined) ||
    undefined;

  if (!fallbackImage) {
    console.warn("⚠️   Detective has no logo or banner. Services will be fixed but may still lack images.");
    console.warn("     Please upload a logo for this detective from the admin panel.");
  }

  // ── 4. Load existing services ────────────────────────────────────────────
  const existingServices = await db
    .select()
    .from(services)
    .where(eq(services.detectiveId, detective.id));

  console.log(`\n📋  Services found: ${existingServices.length}`);

  if (existingServices.length === 0) {
    // No services at all — create a default one
    console.log("➕  No services found, creating a default Background Checks service...");
    const categoryLabel = "Background Checks";
    const slug = generateSlug(`${detective.slug}-${categoryLabel}-services`);
    const imageArr = fallbackImage ? [fallbackImage] : [];

    const [created] = await db.insert(services).values({
      detectiveId: detective.id,
      category: categoryLabel,
      slug,
      title: `${categoryLabel} Services`,
      description: `Professional ${categoryLabel.toLowerCase()} services by ${detective.businessName || "this detective"}. Contact for detailed consultation.`,
      images: imageArr.length > 0 ? sql`${imageArr}::text[]` : sql`ARRAY[]::text[]`,
      basePrice: null,
      offerPrice: null,
      isActive: true,
      isOnEnquiry: true,
    }).returning();
    console.log(`✅  Created service: "${created.title}" (slug: ${created.slug})`);
    console.log(`    Service URL: /service/${(detective as any).countrySlug || "united-states"}/${(detective as any).stateSlug || "north-carolina"}/${(detective as any).citySlug || "greensboro"}/${detective.slug}/${slug}`);
  } else {
    // Fix existing services
    let fixed = 0;
    for (const svc of existingServices) {
      const hasImage = Array.isArray(svc.images) && (svc.images as string[]).length > 0;
      const hasUuidSlug = UUID_PREFIX_RE.test(svc.slug || "");
      const cleanSlug = hasUuidSlug
        ? generateSlug(`${detective.slug}-${svc.category}-services`)
        : svc.slug;

      const needsSlugFix = hasUuidSlug && cleanSlug !== svc.slug;
      const needsImageFix = !hasImage && !!fallbackImage;
      const needsActivate = !svc.isActive;

      console.log(`\n  Service: "${svc.title}"`);
      console.log(`    ID      : ${svc.id}`);
      console.log(`    Slug    : ${svc.slug}${hasUuidSlug ? " ← UUID prefix (will clean)" : " ✓"}`);
      console.log(`    Images  : ${hasImage ? "present ✓" : "MISSING"}`);
      console.log(`    Active  : ${svc.isActive ? "yes ✓" : "NO"}`);

      if (needsSlugFix || needsImageFix || needsActivate) {
        const updates: Record<string, any> = { updatedAt: new Date() };
        if (needsSlugFix) updates.slug = cleanSlug;
        if (needsImageFix) updates.images = [fallbackImage];
        if (needsActivate) updates.isActive = true;

        await db.update(services)
          .set(updates)
          .where(eq(services.id, svc.id));

        fixed++;
        console.log(`    🔧  Fixed: ${[needsSlugFix && "slug", needsImageFix && "image", needsActivate && "activated"].filter(Boolean).join(", ")}`);
        if (needsSlugFix) {
          console.log(`    New slug: ${cleanSlug}`);
        }
      } else {
        console.log(`    ✓  No fixes needed`);
      }
    }
    console.log(`\n📊  Fixed ${fixed} of ${existingServices.length} service(s).`);
  }

  // ── 5. Verify location IDs are set ──────────────────────────────────────
  if (!detective.countryId || !detective.stateId || !detective.cityId) {
    console.warn("\n⚠️   Detective has missing location IDs (countryId/stateId/cityId).");
    console.warn("     They may not appear on location pages until location IDs are backfilled.");
    console.warn("     Run: npx tsx scripts/backfill-missing-location-ids.ts");
  } else {
    console.log(`\n✅  Location IDs are set — detective will appear on service location pages once images are present.`);
  }

  console.log("\n🎉  Done! Yow Johnson should now appear on both service pages and service location pages.");
  process.exit(0);
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
