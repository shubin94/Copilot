EXPLAIN ANALYZE
SELECT DISTINCT ON ("detectives"."id")
  "services"."id" AS "serviceId",
  "services"."title" AS "serviceTitle",
  "services"."category" AS "serviceCategory",
  "services"."basePrice" AS "serviceBasePrice",
  "services"."offerPrice" AS "serviceOfferPrice",
  "services"."isOnEnquiry" AS "serviceIsOnEnquiry",
  ("services"."images")[1] AS "serviceMainImage",
  "services"."orderCount" AS "serviceOrderCount",
  "detectives"."id" AS "detectiveId",
  "detectives"."businessName" AS "detectiveBusinessName",
  "detectives"."level" AS "detectiveLevel",
  "detectives"."logo" AS "detectiveLogo",
  "detectives"."country" AS "detectiveCountry",
  "detectives"."state" AS "detectiveState",
  "detectives"."city" AS "detectiveCity",
  "detectives"."slug" AS "detectiveSlug",
  "detectives"."phone" AS "detectivePhone",
  "detectives"."whatsapp" AS "detectiveWhatsapp",
  "detectives"."contactEmail" AS "detectiveContactEmail",
  "detectives"."isVerified" AS "detectiveIsVerified",
  "detectives"."subscriptionPackageId" AS "detectiveSubscriptionPackageId",
  "detectives"."subscriptionExpiresAt" AS "detectiveSubscriptionExpiresAt",
  "detectives"."hasBlueTick" AS "detectiveHasBlueTick",
  "detectives"."blueTickAddon" AS "detectiveBlueTickAddon",
  "subscriptionPlans"."name" AS "subscriptionPackageName",
  "subscriptionPlans"."badges" AS "subscriptionPackageBadges",
  "reviews_agg"."avgRating" AS "avgRating",
  "reviews_agg"."reviewCount" AS "reviewCount"
FROM "services"
LEFT JOIN "detectives" ON "services"."detectiveId" = "detectives"."id"
LEFT JOIN "subscriptionPlans" ON "detectives"."subscriptionPackageId" = "subscriptionPlans"."id"
LEFT JOIN (
  SELECT
    "reviews"."serviceId" AS "serviceId",
    COALESCE(AVG("reviews"."rating"), 0) AS "avgRating",
    COUNT("reviews"."id") AS "reviewCount"
  FROM "reviews"
  WHERE "reviews"."isPublished" = true
  GROUP BY "reviews"."serviceId"
) AS "reviews_agg" ON "services"."id" = "reviews_agg"."serviceId"
WHERE
  "services"."isActive" = true
  AND "services"."images" IS NOT NULL
  AND array_length("services"."images", 1) > 0
ORDER BY "detectives"."id", "services"."orderCount" DESC
LIMIT 15 OFFSET 0;
