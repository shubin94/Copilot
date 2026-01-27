import { db } from "../db/index.ts";
import { users, detectives, services } from "../shared/schema.ts";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";

async function createTestDetective() {
  try {
    console.log("Creating test detective profile...");

    // Hash the password
    const hashedPassword = await bcrypt.hash("detective123", 10);

    // Create user account
    const [user] = await db.insert(users).values({
      id: nanoid(),
      email: "testdetective@example.com",
      password: hashedPassword,
      name: "Sarah Wilson",
      role: "detective",
    }).returning();

    console.log("✓ Created user account:", user.email);

    // Create detective profile
    const [detective] = await db.insert(detectives).values({
      id: nanoid(),
      userId: user.id,
      businessName: "Wilson Investigation Services",
      bio: "Licensed private investigator with over 15 years of experience in corporate investigations, background checks, and surveillance operations. Specializing in insurance fraud cases, infidelity investigations, and missing persons. Former law enforcement officer with extensive training in evidence collection and legal compliance. Available 24/7 for urgent cases.",
      subscriptionPlan: "pro",
      status: "active",
      isVerified: true,
      country: "United States",
      location: "Los Angeles, California",
      phone: "+13105551234",
      whatsapp: "+13105551234",
      languages: ["English", "Spanish"],
      memberSince: new Date(),
      lastActive: new Date(),
    }).returning();

    console.log("✓ Created detective profile:", detective.businessName);

    // Create services
    const serviceData = [
      {
        id: nanoid(),
        detectiveId: detective.id,
        title: "Comprehensive Background Check",
        description: "Thorough background investigation including criminal records, employment history, education verification, credit reports, and social media analysis. Ideal for pre-employment screening, tenant verification, or due diligence. Complete report delivered within 3-5 business days.",
        category: "Background Check",
        basePrice: 299,
        isActive: true,
        orderCount: 12,
        viewCount: 145,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: nanoid(),
        detectiveId: detective.id,
        title: "Professional Surveillance Service",
        description: "Discreet surveillance operations using advanced tracking technology and experienced investigators. Services include mobile surveillance, stationary observation, video/photo documentation, and detailed activity logs. Perfect for infidelity cases, insurance fraud, or employee monitoring.",
        category: "Surveillance",
        basePrice: 150,
        isActive: true,
        orderCount: 28,
        viewCount: 312,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: nanoid(),
        detectiveId: detective.id,
        title: "Missing Person Investigation",
        description: "Specialized investigation services for locating missing persons including runaways, estranged family members, or lost contacts. Utilizing database searches, field interviews, social media research, and investigative techniques. Compassionate approach with regular updates throughout the process.",
        category: "Missing Persons",
        basePrice: 500,
        isActive: true,
        orderCount: 8,
        viewCount: 89,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: nanoid(),
        detectiveId: detective.id,
        title: "Corporate Investigation & Due Diligence",
        description: "Business intelligence and corporate investigations including fraud detection, asset searches, competitor analysis, and executive background checks. Comprehensive reports suitable for M&A due diligence, partnership evaluation, or litigation support.",
        category: "Corporate Investigation",
        basePrice: 750,
        isActive: true,
        orderCount: 15,
        viewCount: 203,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.insert(services).values(serviceData);

    console.log(`✓ Created ${serviceData.length} services`);
    console.log("\n=== TEST DETECTIVE ACCOUNT CREATED ===");
    console.log("Email: testdetective@example.com");
    console.log("Password: detective123");
    console.log("Business Name: Wilson Investigation Services");
    console.log("Status: Active (publicly visible)");
    console.log("Plan: Pro");
    console.log("Services: 4 active services");
    console.log("=====================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error creating test detective:", error);
    process.exit(1);
  }
}

createTestDetective();
