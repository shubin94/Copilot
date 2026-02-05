import "dotenv/config";
import { db } from "../db/index.ts";
import { users, detectives, services, serviceCategories } from "../shared/schema.ts";

async function verifyData() {
  try {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("✅ DATABASE DATA SUMMARY");
    console.log("═══════════════════════════════════════════════════════\n");

    const categoryCount = await db.select().from(serviceCategories);
    const userCount = await db.select().from(users);
    const detectiveCount = await db.select().from(detectives);
    const serviceCount = await db.select().from(services);

    console.log(`📁 Service Categories: ${categoryCount.length}`);
    categoryCount.forEach(cat => {
      console.log(`   • ${cat.name}`);
    });

    console.log(`\n👥 Users: ${userCount.length}`);
    userCount.forEach(user => {
      console.log(`   • ${user.email} (${user.role})`);
    });

    console.log(`\n🔍 Detectives: ${detectiveCount.length}`);
    detectiveCount.forEach(det => {
      console.log(`   • ${det.businessName} (${det.status})`);
    });

    console.log(`\n🛠️  Services: ${serviceCount.length}`);
    serviceCount.forEach(svc => {
      console.log(`   • ${svc.title} - $${svc.basePrice}`);
    });

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("🔐 TEST CREDENTIALS:");
    console.log("   Email: detective1@example.com");
    console.log("   Password: Detective@123");
    console.log("\n   Email: admin@example.com");
    console.log("   Password: Admin@12345678");
    console.log("═══════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyData();
