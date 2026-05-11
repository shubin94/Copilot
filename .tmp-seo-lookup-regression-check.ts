import "./server/lib/loadEnv.js";
import { getDetectiveBySlugForSEO } from "./server/lib/seo-injection.js";

const detective = await getDetectiveBySlugForSEO("india", "karnataka", "aland", "changappa-a-k");
console.log(JSON.stringify(detective ? {
  id: detective.id,
  businessName: detective.businessName,
  slug: detective.slug,
  city: detective.city,
  state: detective.state,
  country: detective.country,
  avgRating: detective.avgRating,
  reviewCount: detective.reviewCount,
  seoServiceCategories: detective.seoServiceCategories,
  seoPaymentMethods: detective.seoPaymentMethods
} : null, null, 2));
