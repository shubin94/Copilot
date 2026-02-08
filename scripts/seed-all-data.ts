import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { users, detectives, services, serviceCategories } from "../shared/schema.ts";
import bcrypt from "bcrypt";

async function seedData() {
  try {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("🌱 SEEDING DATABASE WITH SAMPLE DATA");
    console.log("═══════════════════════════════════════════════════════\n");

    // 1. Create Service Categories
    console.log("📁 Checking service categories...");
    const existingCategories = await db.select().from(serviceCategories);
    if (existingCategories.length === 0) {
      await db.insert(serviceCategories).values([
        {
          name: "Background Checks",
          description: "Comprehensive background investigations for employment, relationships, or due diligence",
          isActive: true,
        },
        {
          name: "Surveillance",
          description: "Discreet monitoring and observation services for individuals or locations",
          isActive: true,
        },
        {
          name: "Infidelity Investigations",
          description: "Discreet investigations of suspected relationship infidelity",
          isActive: true,
        },
        {
          name: "Corporate Fraud",
          description: "Investigation of corporate fraud, embezzlement, and business misconduct",
          isActive: true,
        },
      ]);
      console.log(`✅ Created 4 categories\n`);
    } else {
      console.log(`✅ Categories already exist (${existingCategories.length})\n`);
    }

    // 2. Create Detective User #1
    console.log("👥 Creating detective users...");
    const hashedPassword = await bcrypt.hash("Detective@123", 10);
    
    const [detective1User] = await db.insert(users).values({
      email: "detective1@example.com",
      password: hashedPassword,
      name: "Detective Agent 1",
      role: "detective",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=detective1",
    }).returning();
    console.log(`✅ Created detective user: ${detective1User.email}`);

    // 3. Create Detective Profile #1
    const [detective1] = await db.insert(detectives).values({
      userId: detective1User.id,
      businessName: "Professional Investigations Ltd",
      bio: "Expert detective agency with 10+ years of experience in background checks and surveillance.",
      country: "US",
      state: "California",
      city: "Los Angeles",
      location: "Los Angeles, CA",
      phone: "+1-555-0101",
      contactEmail: "contact@prodetectives.com",
      status: "active",
      isVerified: true,
      isClaimed: true,
      createdBy: "admin",
      yearsExperience: "10+",
    }).returning();
    console.log(`✅ Created detective profile: ${detective1.businessName}\n`);

    // 4. Create Services for Detective 1
    console.log("🛠️  Creating services...");
    const services1 = await db.insert(services).values([
      {
        detectiveId: detective1.id,
        category: "Background Checks",
        title: "Comprehensive Background Check",
        description: "Full background investigation including criminal records, employment verification, education history, and litigation records.",
        basePrice: "500.00",
        isActive: true,
      },
      {
        detectiveId: detective1.id,
        category: "Surveillance",
        title: "Discrete Surveillance Services",
        description: "Professional surveillance with detailed daily reports and photo/video documentation.",
        basePrice: "1500.00",
        offerPrice: "1200.00",
        isActive: true,
      },
      {
        detectiveId: detective1.id,
        category: "Corporate Fraud",
        title: "Corporate Fraud Investigation",
        description: "Complete investigation of suspected corporate fraud, embezzlement, and misconduct.",
        basePrice: "2000.00",
        isActive: true,
      },
    ]).returning();
    console.log(`✅ Created ${services1.length} services for ${detective1.businessName}\n`);

    // 5. Create Detective User #2
    const [detective2User] = await db.insert(users).values({
      email: "detective2@example.com",
      password: hashedPassword,
      name: "Detective Agent 2",
      role: "detective",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=detective2",
    }).returning();
    console.log(`✅ Created detective user: ${detective2User.email}`);

    // 6. Create Detective Profile #2
    const [detective2] = await db.insert(detectives).values({
      userId: detective2User.id,
      businessName: "Elite Detective Solutions",
      bio: "Specialist in infidelity investigations and personal matters with complete discretion.",
      country: "US",
      state: "New York",
      city: "New York",
      location: "New York, NY",
      phone: "+1-555-0202",
      contactEmail: "info@elitedetectives.com",
      status: "active",
      isVerified: true,
      isClaimed: true,
      createdBy: "admin",
      yearsExperience: "15+",
    }).returning();
    console.log(`✅ Created detective profile: ${detective2.businessName}\n`);

    // 7. Create Services for Detective 2
    const services2 = await db.insert(services).values([
      {
        detectiveId: detective2.id,
        category: "Infidelity Investigations",
        title: "Infidelity Investigation Package",
        description: "Comprehensive infidelity investigation with surveillance and evidence collection.",
        basePrice: "800.00",
        isActive: true,
      },
      {
        detectiveId: detective2.id,
        category: "Background Checks",
        title: "Quick Background Verification",
        description: "Fast background check report within 48 hours.",
        basePrice: "300.00",
        isActive: true,
      },
    ]).returning();
    console.log(`✅ Created ${services2.length} services for ${detective2.businessName}\n`);

    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ SEED DATA CREATED SUCCESSFULLY");
    console.log("═══════════════════════════════════════════════════════");
    console.log("\n📋 SUMMARY:");
    console.log(`  • Categories: ${existingCategories.length}`);
    console.log(`  • Detective Users: 2`);
    console.log(`  • Detective Profiles: 2`);
    console.log(`  • Services: ${services1.length + services2.length}`);
    console.log("\n🔐 LOGIN CREDENTIALS:");
    console.log(`  Detective 1:`);
    console.log(`    Email: ${detective1User.email}`);
    console.log(`    Password: Detective@123`);
    console.log(`  Detective 2:`);
    console.log(`    Email: ${detective2User.email}`);
    console.log(`    Password: Detective@123`);
    console.log("\n═══════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedData();
