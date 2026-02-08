import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { serviceCategories, services, detectives, users } from "../shared/schema.ts";

async function checkData() {
  try {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("📊 DATABASE DATA CHECK");
    console.log("═══════════════════════════════════════════════════════\n");

    // Check categories
    const categories = await db.select().from(serviceCategories);
    console.log(`📁 SERVICE CATEGORIES (${categories.length}):`);
    if (categories.length === 0) {
      console.log("   ⚠️  No categories found!");
    } else {
      categories.forEach((cat: any) => {
        console.log(`   • ${cat.name} (ID: ${cat.id})`);
        console.log(`     Description: ${cat.description || "N/A"}`);
        console.log(`     Active: ${cat.isActive}`);
      });
    }

    // Check users
    console.log(`\n👥 USERS (${(await db.select().from(users)).length}):`);
    const allUsers = await db.select().from(users);
    allUsers.forEach((u: any) => {
      console.log(`   • ${u.name} (${u.email}) - Role: ${u.role}`);
    });

    // Check detectives
    console.log(`\n🔍 DETECTIVES (${(await db.select().from(detectives)).length}):`);
    const allDetectives = await db.select().from(detectives);
    if (allDetectives.length === 0) {
      console.log("   ⚠️  No detectives found!");
    } else {
      allDetectives.forEach((det: any) => {
        console.log(`   • ${det.businessName || "N/A"} (User ID: ${det.userId})`);
        console.log(`     Location: ${det.country} - ${det.city}`);
        console.log(`     Status: ${det.status}`);
      });
    }

    // Check services
    console.log(`\n🛠️  SERVICES (${(await db.select().from(services)).length}):`);
    const allServices = await db.select().from(services);
    if (allServices.length === 0) {
      console.log("   ⚠️  No services found!");
    } else {
      allServices.forEach((svc: any) => {
        console.log(`   • ${svc.title} (Category: ${svc.category})`);
        console.log(`     Detective ID: ${svc.detectiveId}`);
        console.log(`     Price: ${svc.basePrice}`);
      });
    }

    console.log("\n═══════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ Error checking database:", error);
    process.exit(1);
  }
}

checkData();
