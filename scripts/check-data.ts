import "../server/lib/loadEnv.js";
import { db } from "../db/index.ts";
import { serviceCategories, services, detectives, users } from "../shared/schema.ts";

const showPii = process.argv.includes('--show-pii');

async function checkData() {
  try {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("📊 DATABASE DATA CHECK");
    console.log("═══════════════════════════════════════════════════════\n");

    // Load all data once
    const allCategories = await db.select().from(serviceCategories);
    const allUsers = await db.select().from(users);
    const allDetectives = await db.select().from(detectives);
    const allServices = await db.select().from(services);

    // Check categories
    console.log(`📁 SERVICE CATEGORIES (${allCategories.length}):`);
    if (allCategories.length === 0) {
      console.log("   ⚠️  No categories found!");
    } else {
      allCategories.forEach((cat: any) => {
        console.log(`   • ${cat.name} (ID: ${cat.id})`);
        console.log(`     Description: ${cat.description || "N/A"}`);
        console.log(`     Active: ${cat.isActive}`);
      });
    }

    // Check users
    console.log(`\n👥 USERS (${allUsers.length})`);
    allUsers.forEach((u: any) => {
      const emailDisplay = showPii ? u.email : "[redacted]";  
      console.log(`   • ${u.name} (${emailDisplay}) - Role: ${u.role}`);
    });

    // Check detectives
    console.log(`\n🔍 DETECTIVES (${allDetectives.length}):`);
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
    console.log(`\n🛠️  SERVICES (${allServices.length}):`);
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

    process.exit(0);
  } catch (error) {
    console.error("❌ Error checking database:", error);
    process.exit(1);
  }
}

checkData();
