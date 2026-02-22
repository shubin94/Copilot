import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/copilot_full',
});

(async () => {
  try {
    await client.connect();
    
    const result = await client.query(`
EXPLAIN ANALYZE
SELECT DISTINCT ON ("detectives"."id")
  "services"."id" AS "serviceId",
  "services"."title" AS "serviceTitle",
  "services"."category" AS "serviceCategory",
  "services"."base_price" AS "serviceBasePrice",
  "services"."offer_price" AS "serviceOfferPrice",
  "services"."is_on_enquiry" AS "serviceIsOnEnquiry",
  ("services"."images")[1] AS "serviceMainImage",
  "services"."order_count" AS "serviceOrderCount",
  "detectives"."id" AS "detectiveId",
  "detectives"."business_name" AS "detectiveBusinessName",
  "detectives"."level" AS "detectiveLevel",
  "detectives"."logo" AS "detectiveLogo",
  "detectives"."country" AS "detectiveCountry",
  "detectives"."state" AS "detectiveState",
  "detectives"."city" AS "detectiveCity",
  "detectives"."slug" AS "detectiveSlug",
  "detectives"."phone" AS "detectivePhone",
  "detectives"."whatsapp" AS "detectiveWhatsapp",
  "detectives"."contact_email" AS "detectiveContactEmail",
  "detectives"."is_verified" AS "detectiveIsVerified",
  "detectives"."subscription_package_id" AS "detectiveSubscriptionPackageId",
  "detectives"."subscription_expires_at" AS "detectiveSubscriptionExpiresAt",
  "detectives"."has_blue_tick" AS "detectiveHasBlueTick",
  "detectives"."blue_tick_addon" AS "detectiveBlueTickAddon",
  "subscription_plans"."name" AS "subscriptionPackageName",
  "subscription_plans"."badges" AS "subscriptionPackageBadges",
  "reviews_agg"."avg_rating" AS "avgRating",
  "reviews_agg"."review_count" AS "reviewCount"
FROM "services"
LEFT JOIN "detectives" ON "services"."detective_id" = "detectives"."id"
LEFT JOIN "subscription_plans" ON "detectives"."subscription_package_id" = "subscription_plans"."id"
LEFT JOIN (
  SELECT
    "reviews"."service_id" AS "service_id",
    COALESCE(AVG("reviews"."rating"), 0) AS "avg_rating",
    COUNT("reviews"."id") AS "review_count"
  FROM "reviews"
  WHERE "reviews"."is_published" = true
  GROUP BY "reviews"."service_id"
) AS "reviews_agg" ON "services"."id" = "reviews_agg"."service_id"
WHERE
  "services"."is_active" = true
  AND "services"."images" IS NOT NULL
  AND array_length("services"."images", 1) > 0
ORDER BY "detectives"."id", "services"."order_count" DESC
LIMIT 15 OFFSET 0;
    `);

    result.rows.forEach(row => {
      console.log(row['QUERY PLAN']);
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
