import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { users, detectives, services, serviceCategories } from "../shared/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seedData() {
  try {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("🌱 SEEDING DATABASE WITH SAMPLE DATA");
    console.log("═══════════════════════════════════════════════════════\n");

    // 1. Create Service Categories
    console.log("📁 Checking service categories...");
    const existingCategories = await db.select().from(serviceCategories);
    let categoriesCreated = 0;
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
      categoriesCreated = 4;
      console.log(`✅ Created ${categoriesCreated} categories\n`);
    } else {
      console.log(`✅ Categories already exist (${existingCategories.length})\n`);
    }

    // 2. Create Detective User #1
    console.log("👥 Creating detective users...");
    const hashedPassword = await bcrypt.hash("Detective@123", 10);
    
    // Check if detective1@example.com already exists
    const allUsers = await db.select().from(users);
    const detective1UserExists = allUsers.find(u => u.email === "detective1@example.com");
    let detective1User = detective1UserExists;
    let detective1sCreated = 0;
    
    if (!detective1User) {
      const [newUser] = await db.insert(users).values({
        email: "detective1@example.com",
        password: hashedPassword,
        name: "Detective Agent 1",
        role: "detective",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=detective1",
      }).returning();
      detective1User = newUser;
      detective1sCreated = 1;
    }
    console.log(`✅ Detective user: ${detective1User.email}`);

    // 3. Create Detective Profile #1 (with idempotency check)
    let detective1 = await db.query.detectives.findFirst({
      where: eq(detectives.userId, detective1User.id)
    });
    
    if (!detective1) {
      const [newDetective] =  await db.insert(detectives).values({
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
      detective1 = newDetective;
      console.log(`✅ Created detective profile: ${detective1.businessName}\n`);
    } else {
      console.log(`✅ Detective profile already exists: ${detective1.businessName}\n`);
    }

    // 4. Create Services for Detective 1
    console.log("🛠️  Creating services...");
    
    // Check if services already exist for detective1
    const existingServices1 = await db.select().from(services).where(eq(services.detectiveId, detective1.id));
    let services1 = existingServices1;
    
    if (existingServices1.length === 0) {
      services1 = await db.insert(services).values([
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
    } else {
      console.log(`✅ Services already exist for ${detective1.businessName} (${existingServices1.length})\n`);
    }

    // 5. Create Detective User #2
    const detective2UserExists = allUsers.find(u => u.email === "detective2@example.com");
    let detective2User = detective2UserExists;
    let detective2sCreated = 0;
    
    if (!detective2User) {
      const [newUser] = await db.insert(users).values({
        email: "detective2@example.com",
        password: hashedPassword,
        name: "Detective Agent 2",
        role: "detective",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=detective2",
      }).returning();
      detective2User = newUser;
      detective2sCreated = 1;
    }
    console.log(`✅ Detective user: ${detective2User.email}`);

    // 6. Create Detective Profile #2 (with idempotency check)
    let detective2 = await db.query.detectives.findFirst({
      where: eq(detectives.userId, detective2User.id)
    });
    
    if (!detective2) {
      const [newDetective] = await db.insert(detectives).values({
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
      detective2 = newDetective;
      console.log(`✅ Created detective profile: ${detective2.businessName}\n`);
    } else {
      console.log(`✅ Detective profile already exists: ${detective2.businessName}\n`);
    }

    // 7. Create Services for Detective 2
    const existingServices2 = await db.select().from(services).where(eq(services.detectiveId, detective2.id));
    let services2 = existingServices2;
    
    if (existingServices2.length === 0) {
      services2 = await db.insert(services).values([
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
    } else {
      console.log(`✅ Services already exist for ${detective2.businessName} (${existingServices2.length})\n`);
    }

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

    process.exit(0);

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedData();
