import { db } from "../db/index.ts";
import { detectives, detectiveVisibility, services, reviews } from "../shared/schema.ts";
import { eq, desc, and, avg, count, sql } from "drizzle-orm";

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
 * This is the single source of truth for detective ranking
 */
export async function calculateVisibilityScore(detectiveId: string): Promise<number> {
  try {
    const detective = await db.query.detectives.findFirst({
      where: eq(detectives.id, detectiveId),
    });

    if (!detective) return 0;

    // 1️⃣ CHECK MANUAL OVERRIDE FIRST (Highest Priority)
    const visibility = await db.query.detectiveVisibility.findFirst({
      where: eq(detectiveVisibility.detectiveId, detectiveId),
    });

    if (visibility?.manualRank !== null && visibility?.manualRank !== undefined) {
      return visibility.manualRank; // Manual override is absolute - returns immediately
    }

    let score = 0;

    // 2️⃣ LEVEL SCORE (100/200/300/500 - exactly one applies)
    const levelScores: Record<string, number> = {
      "level1": 100,
      "level2": 200,
      "level3": 300,
      "pro": 500,
    };
    score += levelScores[detective.level] || 100; // Default to level1 (100)

    // 3️⃣ BADGE SCORE (Additive - stacking badges)
    // Blue Tick: +100 (when subscription is active pro/agency)
    if (detective.subscriptionPlan === "pro" || detective.subscriptionPlan === "agency") {
      score += 100;
    }

    // Pro Badge: +200 (when active subscription package exists and not expired)
    if (
      detective.subscriptionPackageId &&
      detective.subscriptionExpiresAt &&
      new Date(detective.subscriptionExpiresAt) > new Date()
    ) {
      score += 200;
    }

    // Recommended Badge: +300 (TODO: implement when dedicated badge column added)
    // Currently unused, reserved for future enhancement

    // 4️⃣ ACTIVITY SCORE (0-100 based on lastActive decay)
    const activityScore = calculateActivityScore(detective);
    score += activityScore;

    // 5️⃣ REVIEW SCORE (0-500 based on count + rating)
    const reviewScore = await calculateReviewScore(detectiveId);
    score += reviewScore;

    // Return final score (no artificial cap - can exceed 1000 if multiple high factors present)
    return Math.max(0, score);
  } catch (error) {
    console.error(`[Visibility] Error calculating score for ${detectiveId}:`, error);
    return 0; // Safe default on error
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

    // COUNT SCORE (0-250)
    // Rewards high volume of reviews
    let countScore = 0;
    if (totalReviews >= 50) countScore = 250;
    else if (totalReviews >= 30) countScore = 200;
    else if (totalReviews >= 20) countScore = 150;
    else if (totalReviews >= 10) countScore = 100;
    else if (totalReviews >= 5) countScore = 50;
    else if (totalReviews >= 1) countScore = 25;
    else countScore = 0;

    // RATING SCORE (0-250)
    // Rewards high quality (average rating)
    let ratingScore = 0;
    if (avgRating >= 4.8) ratingScore = 250;
    else if (avgRating >= 4.5) ratingScore = 200;
    else if (avgRating >= 4.2) ratingScore = 150;
    else if (avgRating >= 4.0) ratingScore = 100;
    else if (avgRating >= 3.5) ratingScore = 50;
    else ratingScore = 0;

    return countScore + ratingScore; // Total 0-500
  } catch (error) {
    console.error(`[Visibility] Error calculating review score for ${detectiveId}:`, error);
    return 0; // Safe default on error
  }
}

/**
 * Get ranked detectives for display
 * Applies visibility rules and returns properly ordered list
 * 
 * Returns detectives sorted by:
 * 1. visibilityScore (descending)
 * 2. Reviews count (descending) - tie breaker
 * 3. Activity score (descending) - tie breaker
 * 4. createdAt (descending/recency) - final tie breaker
 * 
 * Filters:
 * - Only detectives with isVisible === true
 * - Only detectives with status === "active"
 * - Respects limit parameter
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
    const status = opts.status || "active";
    const limitVal = opts.limit || 100;

    // Get detectives with their visibility records
    const statusValue = status as "active" | "pending" | "suspended" | "inactive";
    
    const detList = await db
      .select()
      .from(detectives)
      .where(eq(detectives.status, statusValue))
      .limit(limitVal);

    // Enhance with visibility data
    const enhancedList = await Promise.all(
      detList.map(async (detective, index) => {
        const visibility = await db.query.detectiveVisibility.findFirst({
          where: eq(detectiveVisibility.detectiveId, detective.id),
        });

        // Filter out invisible detectives
        if (visibility && !visibility.isVisible) {
          return null;
        }

        // Calculate fresh score
        const visibilityScore = await calculateVisibilityScore(detective.id);

        return {
          ...detective,
          visibilityScore,
          rankPosition: index + 1,
          isVisible: visibility?.isVisible ?? true,
          isFeatured: visibility?.isFeatured ?? false,
        };
      })
    );

    // Remove invisible detectives and sort by score
    const visibleDetectives = enhancedList
      .filter((d) => d !== null)
      .sort((a, b) => {
        // Primary: visibility score (higher first)
        if (b.visibilityScore !== a.visibilityScore) {
          return b.visibilityScore - a.visibilityScore;
        }
        // Secondary: recency (newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    // Update rank positions after sorting
    return visibleDetectives.map((detective, index) => ({
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
