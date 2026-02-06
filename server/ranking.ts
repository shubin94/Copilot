import { db } from "../db/index.ts";
import { detectives, detectiveVisibility, services, reviews, subscriptionPlans } from "../shared/schema.ts";
import { eq, desc, and, avg, count, sql, inArray } from "drizzle-orm";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISIBILITY SCORE ALGORITHM - LEVELS + BADGES + ACTIVITY + REVIEWS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FORMULA: visibilityScore = manual + level + badges + activity + reviews
 *
 * 1️⃣ MANUAL OVERRIDE (0-1000) - Highest Priority, Admin Controlled
 *    - Overrides all other factors when set
 *    - Applied as direct score
 *
 * 2️⃣ LEVEL SCORE (Exactly ONE applies per detective)
 *    - Level 1 → +100
 *    - Level 2 → +200
 *    - Level 3 → +300
 *    - Pro Level → +500
 *    - Source: detective.level field
 *
 * 3️⃣ BADGE SCORE (Additive - all applicable badges stack)
 *    - Blue Tick → +100
 *    - Pro Badge → +200
 *    - Recommended Badge → +300
 *    - Sources: subscription status, verified status
 *
 * 4️⃣ ACTIVITY SCORE (0-100)
 *    - Recent login within 1 day → 100
 *    - Recent within 7 days → 75
 *    - Recent within 30 days → 50
 *    - Recent within 90 days → 25
 *    - Inactive 90+ days → 0
 *    - Source: detective.lastActive timestamp
 *
 * 5️⃣ REVIEW SCORE (0-500)
 *    - Count Score (0-250): Based on number of published reviews
 *    - Rating Score (0-250): Based on average rating
 *    - Sources: reviews table joined via services
 *
 * RANKING RULES:
 * - Higher visibilityScore ranks higher
 * - Ties broken by: Manual > Reviews > Activity > Recency
 * - If isVisible === false, NEVER show regardless of score
 * - Missing data → score = 0 for that component
 * - Errors → safe default, no crashes
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Calculate complete visibility score using Levels + Badges + Activity + Reviews
 * Optimized version: accepts pre-loaded data to avoid redundant queries
 * 
 * @param detective - Detective record (required)
 * @param visibility - Pre-loaded visibility record (optional, will fetch if not provided)
 * @param reviewData - Pre-calculated review stats (optional, will calculate if not provided)
 */
export async function calculateVisibilityScore(
  detective: any,
  visibility?: any,
  reviewData?: { totalReviews: number; avgRating: number }
): Promise<number> {
  try {
    // Handle legacy call with just detectiveId string
    if (typeof detective === "string") {
      const detRecord = await db.query.detectives.findFirst({
        where: eq(detectives.id, detective),
      });
      if (!detRecord) return 0;
      
      const vis = await db.query.detectiveVisibility.findFirst({
        where: eq(detectiveVisibility.detectiveId, detective),
      });
      
      const reviews = await calculateReviewScore(detective);
      return calculateVisibilityScore(detRecord, vis, { totalReviews: 0, avgRating: 0 });
    }

    // 1️⃣ CHECK MANUAL OVERRIDE FIRST (Highest Priority)
    if (visibility?.manualRank !== null && visibility?.manualRank !== undefined) {
      return visibility.manualRank; // Manual override is absolute
    }

    let score = 0;

    // 2️⃣ LEVEL SCORE (100/200/300/500 - exactly one applies)
    const levelScores: Record<string, number> = {
      "level1": 100,
      "level2": 200,
      "level3": 300,
      "pro": 500,
    };
    score += levelScores[detective.level] || 100;

    // 3️⃣ BADGE SCORE (Additive - stacking badges)
    // Check if detective has a "pro" or "agency" subscription package
    const packageName = detective.subscriptionPackage?.name;
    if (packageName === "pro" || packageName === "agency") {
      score += 100;
    }

    if (
      detective.subscriptionPackageId &&
      detective.subscriptionExpiresAt &&
      new Date(detective.subscriptionExpiresAt) > new Date()
    ) {
      score += 200;
    }

    // 4️⃣ ACTIVITY SCORE (0-100 based on lastActive decay)
    const activityScore = calculateActivityScore(detective);
    score += activityScore;

    // 5️⃣ REVIEW SCORE (0-500 based on count + rating)
    let reviewScore = 0;
    if (reviewData) {
      reviewScore = calculateReviewScoreFromData(reviewData.totalReviews, reviewData.avgRating);
    }
    score += reviewScore;

    return Math.max(0, score);
  } catch (error) {
    console.error(`[Visibility] Error calculating score:`, error);
    return 0;
  }
}

/**
 * Calculate activity score (0-100) with time-based decay
 * Factors:
 * - Last login time (lastActive field)
 * - Exponential decay over 90 days
 */
function calculateActivityScore(detective: any): number {
  if (!detective.lastActive) {
    return 0; // No activity data = 0 score
  }

  const now = new Date();
  const lastActiveTime = new Date(detective.lastActive);
  const daysSinceActive = (now.getTime() - lastActiveTime.getTime()) / (1000 * 60 * 60 * 24);

  // Decay curve: highest for very recent activity, exponential decay
  if (daysSinceActive < 1) {
    return 100; // Active within 24 hours
  } else if (daysSinceActive < 7) {
    return 75; // Active within 7 days
  } else if (daysSinceActive < 30) {
    return 50; // Active within 30 days
  } else if (daysSinceActive < 90) {
    return 25; // Active within 90 days
  } else {
    return 0; // Inactive 90+ days
  }
}

/**
 * Calculate review score from pre-loaded data (0-500)
 * Moved to separate function to support bulk calculations
 */
function calculateReviewScoreFromData(totalReviews: number, avgRating: number): number {
  // COUNT SCORE (0-250)
  let countScore = 0;
  if (totalReviews >= 50) countScore = 250;
  else if (totalReviews >= 30) countScore = 200;
  else if (totalReviews >= 20) countScore = 150;
  else if (totalReviews >= 10) countScore = 100;
  else if (totalReviews >= 5) countScore = 50;
  else if (totalReviews >= 1) countScore = 25;
  else countScore = 0;

  // RATING SCORE (0-250)
  let ratingScore = 0;
  if (avgRating >= 4.8) ratingScore = 250;
  else if (avgRating >= 4.5) ratingScore = 200;
  else if (avgRating >= 4.2) ratingScore = 150;
  else if (avgRating >= 4.0) ratingScore = 100;
  else if (avgRating >= 3.5) ratingScore = 50;
  else ratingScore = 0;

  return countScore + ratingScore;
}

/**
 * Calculate review score (0-500) deterministically
 * Combines:
 * - Review count score (0-250)
 * - Average rating score (0-250)
 *
 * Deterministic: Same detective always gets same score for same data
 * No randomization
 */
async function calculateReviewScore(detectiveId: string): Promise<number> {
  try {
    // Get all services for this detective
    const detectiveServices = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.detectiveId, detectiveId));

    if (detectiveServices.length === 0) {
      return 0; // No services = 0 review score
    }

    const serviceIds = detectiveServices.map((s) => s.id);

    // Query reviews for detective's services
    const reviewStats = await db
      .select({
        totalReviews: count(reviews.id),
        avgRating: avg(reviews.rating),
      })
      .from(reviews)
      .where(
        and(
          sql`${reviews.serviceId} = ANY(${sql.raw(`ARRAY[${serviceIds.map((id) => `'${id}'`).join(",")}]`)}::text[])`,
          eq(reviews.isPublished, true)
        )
      );

    const stat = reviewStats[0];
    if (!stat || !stat.totalReviews) {
      return 0; // No reviews = 0 score
    }

    const totalReviews = Number(stat.totalReviews) || 0;
    const avgRating = stat.avgRating ? Number(stat.avgRating) : 0;

    return calculateReviewScoreFromData(totalReviews, avgRating);
  } catch (error) {
    console.error(`[Visibility] Error calculating review score for ${detectiveId}:`, error);
    return 0; // Safe default on error
  }
}

/**
 * Get ranked detectives for display
 * OPTIMIZED: Batches all queries to eliminate N+1 problems
 * 
 * Query Plan:
 * 1. Load detectives with limit
 * 2. Batch load all visibility records (1 query)
 * 3. Batch load all services for those detectives (1 query)
 * 4. Batch aggregate all reviews (1 query)
 * 5. Calculate scores in-memory (0 queries)
 * 
 * Total: 4-5 queries instead of 300+ queries
 * 
 * Returns detectives sorted by:
 * 1. visibilityScore (descending)
 * 2. createdAt (descending/recency) - tie breaker
 */
export async function getRankedDetectives(options?: {
  country?: string;
  status?: string;
  plan?: string;
  searchQuery?: string;
  limit?: number;
} | number) {
  try {
    // Handle backward compatibility - if options is a number, treat it as limit
    const opts = typeof options === "number" ? { limit: options } : options || {};
    const limitVal = opts.limit || 100;

    // ✅ QUERY 1: Load detectives
    let query = db.select().from(detectives);
    if (opts.status) {
      const statusValue = opts.status as "active" | "pending" | "suspended" | "inactive";
      query = query.where(eq(detectives.status, statusValue)) as any;
    }
    const detList = await query.limit(limitVal);

    if (detList.length === 0) {
      return [];
    }

    const detIds = detList.map((d) => d.id);

    // ✅ QUERY 2: Batch load subscription packages
    const uniquePackageIds = Array.from(new Set(detList
      .map((d) => d.subscriptionPackageId)
      .filter((id): id is string => !!id)
    ));
    
    const packagesMap = new Map<string, any>();
    if (uniquePackageIds.length > 0) {
      const packages = await db
        .select()
        .from(subscriptionPlans)
        .where(inArray(subscriptionPlans.id, uniquePackageIds));
      
      for (const pkg of packages) {
        packagesMap.set(pkg.id, pkg);
      }
    }

    // ✅ QUERY 3: Batch load all visibility records in ONE query
    const allVisibility = await db
      .select()
      .from(detectiveVisibility)
      .where(inArray(detectiveVisibility.detectiveId, detIds));

    const visibilityMap = new Map(allVisibility.map((v) => [v.detectiveId, v]));

    // ✅ QUERY 4: Batch load all services for these detectives in ONE query
    const allServices = await db
      .select({ id: services.id, detectiveId: services.detectiveId })
      .from(services)
      .where(inArray(services.detectiveId, detIds));

    const servicesByDetective = new Map<string, string[]>();
    for (const svc of allServices) {
      const existing = servicesByDetective.get(svc.detectiveId) || [];
      existing.push(svc.id);
      servicesByDetective.set(svc.detectiveId, existing);
    }

    // ✅ QUERY 5: Batch aggregate reviews for ALL services in ONE query
    const allServiceIds = Array.from(new Set(allServices.map((s) => s.id)));
    let reviewAggregates = new Map<string, { totalReviews: number; avgRating: number }>();

    if (allServiceIds.length > 0) {
      const reviewStats = await db
        .select({
          serviceId: reviews.serviceId,
          totalReviews: count(reviews.id),
          avgRating: avg(reviews.rating),
        })
        .from(reviews)
        .where(
          and(
            inArray(reviews.serviceId, allServiceIds),
            eq(reviews.isPublished, true)
          )
        )
        .groupBy(reviews.serviceId);

      // Map service-level reviews back to detective-level aggregates
      const reviewsByService = new Map<string, { totalReviews: number; avgRating: number }>();
      for (const stat of reviewStats) {
        if (stat.serviceId) {
          reviewsByService.set(stat.serviceId, {
            totalReviews: Number(stat.totalReviews) || 0,
            avgRating: stat.avgRating ? Number(stat.avgRating) : 0,
          });
        }
      }

      // Aggregate reviews by detective
      for (const [detectiveId, serviceIds] of servicesByDetective) {
        let totalReviewsForDetective = 0;
        let sumRatings = 0;
        let ratingCount = 0;

        for (const serviceId of serviceIds) {
          const stats = reviewsByService.get(serviceId);
          if (stats) {
            totalReviewsForDetective += stats.totalReviews;
            sumRatings += stats.avgRating * stats.totalReviews;
            ratingCount += stats.totalReviews;
          }
        }

        reviewAggregates.set(detectiveId, {
          totalReviews: totalReviewsForDetective,
          avgRating: ratingCount > 0 ? sumRatings / ratingCount : 0,
        });
      }
    }

    // ✅ IN-MEMORY CALCULATION: Build enhanced list with scores
    const enhancedList = detList.map((detective) => {
      const visibility = visibilityMap.get(detective.id) ?? {
        isVisible: true,
        isFeatured: false,
        manualRank: null,
      };
      
      const reviewData = reviewAggregates.get(detective.id) ?? {
        totalReviews: 0,
        avgRating: 0,
      };

      // Calculate visibility score with pre-loaded data (no queries!)
      let score = 0;

      // Manual override check
      if (visibility.manualRank !== null && visibility.manualRank !== undefined) {
        score = visibility.manualRank;
      } else {
        // Level score
        const levelScores: Record<string, number> = {
          "level1": 100,
          "level2": 200,
          "level3": 300,
          "pro": 500,
        };
        score += levelScores[detective.level] || 100;

        // Badge scores
        if (detective.subscriptionPlan === "pro" || detective.subscriptionPlan === "agency") {
          score += 100;
        }
        if (
          detective.subscriptionPackageId &&
          detective.subscriptionExpiresAt &&
          new Date(detective.subscriptionExpiresAt) > new Date()
        ) {
          score += 200;
        }

        // Activity score
        score += calculateActivityScore(detective);

        // Review score from pre-aggregated data
        score += calculateReviewScoreFromData(reviewData.totalReviews, reviewData.avgRating);
      }

      return {
        ...detective,
        subscriptionPackage: detective.subscriptionPackageId 
          ? packagesMap.get(detective.subscriptionPackageId) 
          : undefined,
        visibilityScore: score,
        isVisible: visibility.isVisible ?? true,
        isFeatured: visibility.isFeatured ?? false,
      };
    });

    // ✅ Sort by visibility score, then by recency
    const sortedDetectives = enhancedList.sort((a, b) => {
      if (b.visibilityScore !== a.visibilityScore) {
        return b.visibilityScore - a.visibilityScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Add rank positions
    return sortedDetectives.map((detective, index) => ({
      ...detective,
      rankPosition: index + 1,
    }));
  } catch (error) {
    console.error("[Ranking] Error calculating detective rankings:", error);
    // Fallback: return active detectives in creation order
    const opts = typeof options === "number" ? { limit: options } : options || {};
    const statusValue = (opts.status || "active") as "active" | "pending" | "suspended" | "inactive";
    
    return await db
      .select()
      .from(detectives)
      .where(eq(detectives.status, statusValue))
      .orderBy(desc(detectives.createdAt))
      .limit(opts.limit || 100);
  }
}

/**
 * Ensure detective has a visibility record
 * Creates with safe defaults if missing
 */
export async function ensureVisibilityRecord(detectiveId: string) {
  try {
    const existing = await db.query.detectiveVisibility.findFirst({
      where: eq(detectiveVisibility.detectiveId, detectiveId),
    });

    if (!existing) {
      await db.insert(detectiveVisibility).values({
        detectiveId,
        isVisible: true,
        isFeatured: false,
        manualRank: null,
        visibilityScore: "0",
      });
    }
  } catch (error) {
    console.error("[Ranking] Error ensuring visibility record:", error);
  }
}

/**
 * Update detective visibility settings (Admin Only)
 */
export async function updateVisibility(
  detectiveId: string,
  updates: {
    isVisible?: boolean;
    isFeatured?: boolean;
    manualRank?: number | null;
  }
) {
  try {
    await ensureVisibilityRecord(detectiveId);

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.isVisible !== undefined) {
      updateData.isVisible = updates.isVisible;
    }
    if (updates.isFeatured !== undefined) {
      updateData.isFeatured = updates.isFeatured;
    }
    if (updates.manualRank !== undefined) {
      updateData.manualRank = updates.manualRank;
    }

    await db
      .update(detectiveVisibility)
      .set(updateData)
      .where(eq(detectiveVisibility.detectiveId, detectiveId));

    return { success: true };
  } catch (error) {
    console.error("[Ranking] Error updating visibility:", error);
    throw error;
  }
}

/**
 * Recalculate and store visibility score for a detective
 * Should be called periodically or after changes to reviews/activity
 */
export async function recalculateVisibilityScore(detectiveId: string) {
  try {
    const score = await calculateVisibilityScore(detectiveId);
    
    await ensureVisibilityRecord(detectiveId);
    
    await db
      .update(detectiveVisibility)
      .set({
        visibilityScore: String(score),
        lastEvaluatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(detectiveVisibility.detectiveId, detectiveId));

    return { success: true, score };
  } catch (error) {
    console.error("[Ranking] Error recalculating visibility score:", error);
    throw error;
  }
}
