import "dotenv/config";
import { db } from "./db/index.ts";
import { services, detectives, users } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function checkServiceDescriptions() {
  console.log("Checking service descriptions...\n");

  const allServices = await db
    .select({
      id: services.id,
      title: services.title,
      description: services.description,
      detectiveId: services.detectiveId,
    })
    .from(services);

  console.log(`Total services: ${allServices.length}\n`);

  // Check for services with "Service from approved application"
  const incorrectDescriptions = allServices.filter(
    (s) => s.description === "Service from approved application"
  );

  console.log(
    `Services with "Service from approved application": ${incorrectDescriptions.length}\n`
  );

  if (incorrectDescriptions.length > 0) {
    console.log("First 10 services with incorrect descriptions:");
    for (const service of incorrectDescriptions.slice(0, 10)) {
      console.log(`\nService ID: ${service.id}`);
      console.log(`Title: ${service.title}`);
      console.log(`Description: ${service.description}`);
      console.log(`Detective ID: ${service.detectiveId}`);
    }
  }

  // Check for services with correct descriptions
  const correctDescriptions = allServices.filter(
    (s) =>
      s.description &&
      s.description !== "Service from approved application" &&
      s.description.length > 50
  );

  console.log(`\n\nServices with proper descriptions: ${correctDescriptions.length}`);

  if (correctDescriptions.length > 0) {
    console.log("\nExample of correct descriptions:");
    for (let i = 0; i < Math.min(3, correctDescriptions.length); i++) {
      const service = correctDescriptions[i];

      console.log(`\n${i + 1}. ${service.title}`);
      console.log(`   Service ID: ${service.id}`);
      console.log(`   Detective ID: ${service.detectiveId}`);
      console.log(`   Description: ${service.description.substring(0, 150)}...`);
    }
  }

  process.exit(0);
}

checkServiceDescriptions().catch(console.error);
