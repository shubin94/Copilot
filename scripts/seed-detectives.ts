import "../server/lib/loadEnv";
import { storage } from "../server/storage.ts";
import type { InsertUser, InsertDetective, InsertService } from "../shared/schema.ts";
import * as LocationService from "../server/services/locationService.ts";

async function main() {
  const existing = await storage.getAllDetectives(1, 0);
  if (existing.length > 0) {
    console.log("Detectives already exist. No seed needed.");
    return;
  }

  const user1: InsertUser = {
    email: "seed.detective1@example.com",
    password: "SeedPass123!",
    name: "Seed Detective One",
    role: "detective",
  } as any;
  const createdUser1 = await storage.createUser(user1);

  // Resolve location IDs for US
  const locationIds1 = await LocationService.resolveLocationIds("US", "Not specified", "Not specified");

  const det1: InsertDetective = {
    userId: createdUser1.id,
    businessName: "Seed Detective Agency",
    bio: "Professional detective ready to help with your case.",
    country: "US",
    countryId: locationIds1.countryId!,
    stateId: locationIds1.stateId!,
    cityId: locationIds1.cityId!,
    status: "active",
    isVerified: true,
    isClaimed: true,
    isClaimable: false,
    createdBy: "self",
  } as any;
  const createdDet1 = await storage.createDetective(det1);

  const svc1: InsertService = {
    detectiveId: createdDet1.id,
    category: "Background Check",
    title: "Comprehensive Background Check",
    description: "Detailed background investigation including records and references.",
    images: ["https://picsum.photos/seed/background/800/400"],
    basePrice: "199.00",
    isActive: true,
  } as any;
  await storage.createService(svc1);

  const user2: InsertUser = {
    email: "seed.detective2@example.com",
    password: "SeedPass456!",
    name: "Seed Detective Two",
    role: "detective",
  } as any;
  const createdUser2 = await storage.createUser(user2);

  // Resolve location IDs for US
  const locationIds2 = await LocationService.resolveLocationIds("US", "Not specified", "Not specified");

  const det2: InsertDetective = {
    userId: createdUser2.id,
    businessName: "Investigation Pros",
    bio: "Trusted investigations for legal and personal matters.",
    country: "US",
    countryId: locationIds2.countryId!,
    stateId: locationIds2.stateId!,
    cityId: locationIds2.cityId!,
    status: "active",
    isVerified: true,
    isClaimed: true,
    isClaimable: false,
    createdBy: "self",
  } as any;
  const createdDet2 = await storage.createDetective(det2);

  const svc2: InsertService = {
    detectiveId: createdDet2.id,
    category: "Surveillance",
    title: "Discreet Surveillance Service",
    description: "Covert surveillance with comprehensive reporting.",
    images: ["https://picsum.photos/seed/surveillance/800/400"],
    basePrice: "299.00",
    isActive: true,
  } as any;
  await storage.createService(svc2);

  console.log("Seed completed: 2 detectives with services created.");
}

main().catch((e) => {
  console.error("Seed error:", e);
  process.exitCode = 1;
});
