import { db } from "./index";
import { users, detectives, services, reviews, orders, serviceCategories } from "../shared/schema.ts";
import bcrypt from "bcrypt";

async function seed() {
  console.log("🌱 Starting database seeding...");

  const hashedPassword = await bcrypt.hash("admin123", 10);

  await db.insert(users).values({
    email: "admin@finddetectives.com",
    password: hashedPassword,
    name: "Administrator",
    role: "admin",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
  });

  console.log("✅ Admin user created");

  await db.insert(serviceCategories).values([
    {
      name: "Surveillance",
      description: "Discreet monitoring and observation services for individuals or locations",
      isActive: true,
    },
    {
      name: "Background Checks",
      description: "Comprehensive background investigations for employment, relationships, or due diligence",
      isActive: true,
    },
    {
      name: "Missing Persons",
      description: "Specialized investigations to locate missing individuals or lost contacts",
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
    {
      name: "Cyber Investigation",
      description: "Digital forensics and investigation of cybercrime, hacking, and online fraud",
      isActive: true,
    },
  ]);

  console.log("✅ Service categories created");

  // Create a sample detective user
  const detectivePassword = await bcrypt.hash("detective123", 10);
  const [detectiveUser] = await db.insert(users).values({
    email: "jane.doe@detectives.example",
    password: detectivePassword,
    name: "Jane Doe",
    role: "detective",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jane"
  }).returning();

  // Create detective profile
  const [detective] = await db.insert(detectives).values({
    userId: detectiveUser.id,
    businessName: "Doe Investigations",
    bio: "Licensed private investigator specializing in surveillance and background checks.",
    country: "US",
    location: "Austin, TX",
    phone: "+1 512-555-0199",
    subscriptionPlan: "pro",
    status: "active",
    isVerified: true,
    isClaimed: true,
    createdBy: "self"
  }).returning();

  // Create services
  const [svc1] = await db.insert(services).values({
    detectiveId: detective.id,
    category: "Surveillance",
    title: "Discrete Surveillance Operations",
    description: "Professional surveillance for domestic and corporate cases with daily reporting.",
    basePrice: "500.00",
    isActive: true
  }).returning();

  const [svc2] = await db.insert(services).values({
    detectiveId: detective.id,
    category: "Background Checks",
    title: "Comprehensive Background Check",
    description: "In-depth background verification including employment, education, and litigation records.",
    basePrice: "300.00",
    isActive: true
  }).returning();

  // Create a sample user who orders and reviews
  const userPassword = await bcrypt.hash("user12345", 10);
  const [regularUser] = await db.insert(users).values({
    email: "john.client@example.com",
    password: userPassword,
    name: "John Client",
    role: "user",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=john"
  }).returning();

  // Create orders
  const [order1] = await db.insert(orders).values({
    orderNumber: "ORD-0001",
    serviceId: svc1.id,
    userId: regularUser.id,
    detectiveId: detective.id,
    amount: "500.00",
    status: "completed",
    requirements: "3 days surveillance, daily reports"
  }).returning();

  const [order2] = await db.insert(orders).values({
    orderNumber: "ORD-0002",
    serviceId: svc2.id,
    userId: regularUser.id,
    detectiveId: detective.id,
    amount: "300.00",
    status: "in_progress",
    requirements: "Background check for employment"
  }).returning();

  // Create reviews
  await db.insert(reviews).values([
    {
      serviceId: svc1.id,
      userId: regularUser.id,
      orderId: order1.id,
      rating: 5,
      comment: "Outstanding professionalism and timely updates. Highly recommended.",
      isPublished: true
    },
    {
      serviceId: svc2.id,
      userId: regularUser.id,
      orderId: order2.id,
      rating: 4,
      comment: "Thorough and detailed report. Slight delay but good overall.",
      isPublished: true
    }
  ]);

  console.log("✅ Demo detective, services, orders, and reviews created");

  console.log("\n🎉 Database seeding completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`- 1 Admin user`);
  console.log(`- 1 Detective user + profile`);
  console.log(`- 2 Services`);
  console.log(`- 2 Orders`);
  console.log(`- 2 Reviews`);
  console.log(`- 6 Service categories`);
  console.log("\n🔐 Admin credentials:");
  console.log("Email: admin@finddetectives.com");
  console.log("Password: admin123");
  console.log("\n👤 Detective credentials:");
  console.log("Email: jane.doe@detectives.example");
  console.log("Password: detective123");
  console.log("\n👤 User credentials:");
  console.log("Email: john.client@example.com");
  console.log("Password: user12345");
}

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
