import "../server/lib/loadEnv";
import { db } from "../db/index.ts"
import { sql } from "drizzle-orm"
import {
  users, detectives, services, servicePackages, reviews, orders, favorites,
  detectiveApplications, profileClaims, billingHistory, serviceCategories,
  searchStats, siteSettings, session
} from "../shared/schema.ts"

async function count(table: any) {
  const rows = await db.select({ c: sql<number>`count(*)` }).from(table)
  return Number((rows[0] as any).c)
}

async function main() {
  const result = {
    users: await count(users),
    detectives: await count(detectives),
    services: await count(services),
    service_packages: await count(servicePackages),
    reviews: await count(reviews),
    orders: await count(orders),
    favorites: await count(favorites),
    detective_applications: await count(detectiveApplications),
    profile_claims: await count(profileClaims),
    billing_history: await count(billingHistory),
    service_categories: await count(serviceCategories),
    search_stats: await count(searchStats),
    site_settings: await count(siteSettings),
    session: await count(session),
  }
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main()
