import { db, pool } from "../db/index.ts";
import { detectives, caseStudies, cities } from "../shared/schema.ts";
import { eq, desc, gt } from "drizzle-orm";
import { googleIndexing } from "../server/services/google-indexing-service.ts";

/**
 * Batch Indexing Script
 * Submits the top 100 highest-priority URLs to Google Indexing API
 * Categories of URLs:
 * 1. Featured detectives (Pro, Blue Tick, etc.)
 * 2. Main city directories (top countries, states, cities)
 * 3. Featured case studies
 */

interface UrlEntry {
  url: string;
  priority: number; // Lower = higher priority (following XML sitemap convention)
  type: string; // "detective" | "city" | "article"
}

async function batchIndexTopUrls() {
  try {
    console.log("🚀 Starting batch indexing of top priority URLs...\n");

    const urls: UrlEntry[] = [];

    // 1. Fetch Featured Detectives (highest priority)
    console.log("📝 Fetching featured detectives...");
    const featuredDetectives = await db
      .select()
      .from(detectives)
      .where(gt(detectives.id, "")) // Simple way to select all with sorting
      .orderBy(desc(detectives.createdAt))
      .limit(30); // Top 30 featured detectives

    featuredDetectives.forEach((detective) => {
      if (detective.slug && detective.country && detective.state && detective.city) {
        const countrySlug = detective.country
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");
        const stateSlug = detective.state
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");
        const citySlug = detective.city
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");

        const url = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/${detective.slug}/`;
        urls.push({
          url,
          priority: 0.8,
          type: "detective",
        });
      }
    });

    console.log(`✅ Added ${featuredDetectives.length} featured detective URLs\n`);

    // 2. Fetch Featured Case Studies (high priority)
    console.log("📝 Fetching featured case studies...");
    const featuredArticles = await db
      .select()
      .from(caseStudies)
      .where(eq(caseStudies.featured, true))
      .orderBy(desc(caseStudies.publishedAt))
      .limit(25); // Top 25 featured articles

    featuredArticles.forEach((article) => {
      if (article.slug) {
        const url = `https://www.askdetectives.com/news/${article.slug}`;
        urls.push({
          url,
          priority: 0.75,
          type: "article",
        });
      }
    });

    console.log(`✅ Added ${featuredArticles.length} featured article URLs\n`);

    // 3. City Directory URLs (generated from top cities)
    console.log("📝 Generating city directory URLs...");
    const topCities = await db
      .select()
      .from(cities)
      .orderBy(desc(cities.name))
      .limit(30); // Top 30 cities

    // Also add country and state level directories
    const countryStateUrls = new Set<string>();

    topCities.forEach((city) => {
      if (city.name && city.stateName && city.countryCode) {
        const countrySlug = city.countryCode
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");
        const stateSlug = city.stateName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");
        const citySlug = city.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");

        // City URL
        const cityUrl = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/`;
        urls.push({
          url: cityUrl,
          priority: 0.7,
          type: "city",
        });

        // Add country and state URLs (deduplicated)
        const countryUrl = `https://www.askdetectives.com/detectives/${countrySlug}/`;
        const stateUrl = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`;

        if (!countryStateUrls.has(countryUrl)) {
          urls.push({
            url: countryUrl,
            priority: 0.6,
            type: "city",
          });
          countryStateUrls.add(countryUrl);
        }

        if (!countryStateUrls.has(stateUrl)) {
          urls.push({
            url: stateUrl,
            priority: 0.65,
            type: "city",
          });
          countryStateUrls.add(stateUrl);
        }
      }
    });

    console.log(`✅ Added ${topCities.length} city and regional directory URLs\n`);

    // 4. Sort by priority and take top 100
    const prioritizedUrls = urls
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 100);

    console.log(`📊 Total URLs to index: ${prioritizedUrls.length}\n`);
    console.log("📋 URL breakdown by type:");
    console.log(
      `   - Detectives: ${prioritizedUrls.filter((u) => u.type === "detective").length}`
    );
    console.log(
      `   - Articles: ${prioritizedUrls.filter((u) => u.type === "article").length}`
    );
    console.log(`   - Cities: ${prioritizedUrls.filter((u) => u.type === "city").length}\n`);

    // 5. Submit in batches to Google
    console.log("🔔 Submitting URLs to Google Indexing API...\n");

    const urlsToSubmit = prioritizedUrls.map((u) => u.url);
    const results = await googleIndexing.submitBatch(urlsToSubmit, "URL_UPDATED", 200);

    // 6. Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    console.log("\n✨ Batch indexing complete!");
    console.log(`📊 Results: ${successful} succeeded, ${failed} failed out of ${results.length} total`);

    if (successful > 0) {
      console.log(
        `\n🎉 Successfully submitted ${successful} URLs to Google Search Console`
      );
      console.log("💡 Check Google Search Console in 24-48 hours to see indexing status");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Batch indexing failed:", error);
    process.exit(1);
  }
}

// Run the batch indexing
batchIndexTopUrls();
