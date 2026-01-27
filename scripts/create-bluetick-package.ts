import { db } from "../db/index.ts";
import { subscriptionPlans } from "../shared/schema.ts";

console.log("Creating Blue Tick package...\n");

const blueTick = await db.insert(subscriptionPlans).values({
  name: "bluetick",
  displayName: "Blue Tick Verification",
  monthlyPrice: "15.00",
  yearlyPrice: "150.00",
  description: "Stand out with a verified badge on your profile.",
  features: ["verified_badge", "contact_email", "contact_phone", "contact_whatsapp"],
  serviceLimit: 999, // No limit, it's an addon
  isActive: true,
} as any).returning();

console.log("✅ Blue Tick package created:");
console.log(`   ID: ${blueTick[0].id}`);
console.log(`   Name: ${blueTick[0].name}`);
console.log(`   Display: ${blueTick[0].displayName}`);
console.log(`   Monthly: $${blueTick[0].monthlyPrice}`);
console.log(`   Yearly: $${blueTick[0].yearlyPrice}`);

console.log("\n⚠️  Remember to update subscription.tsx with this ID:");
console.log(`   ${blueTick[0].id}`);

process.exit(0);
