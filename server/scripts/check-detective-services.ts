import { db } from "../../db/index.js";
import { services } from "@shared/schema";
import { eq } from "drizzle-orm";

const detectiveId = "17490a09-c4f7-41f4-9607-96cd5d45630a";

console.log(`Checking services for detective: ${detectiveId}`);

const allServices = await db.select()
  .from(services)
  .where(eq(services.detectiveId, detectiveId));

console.log(`\nTotal services found: ${allServices.length}`);

allServices.forEach((service, index) => {
  console.log(`\n--- Service ${index + 1} ---`);
  console.log(`Title: ${service.title}`);
  console.log(`ID: ${service.id}`);
  console.log(`Active: ${service.isActive}`);
  console.log(`On Enquiry: ${service.isOnEnquiry}`);
  console.log(`Images: ${service.images ? JSON.stringify(service.images) : 'null'}`);
  console.log(`Category: ${service.category}`);
  console.log(`Base Price: ${service.basePrice}`);
});

process.exit(0);
