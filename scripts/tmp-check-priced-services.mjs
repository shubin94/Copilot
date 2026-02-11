#!/usr/bin/env node
import { db } from "../db/index.ts";
import { services, detectives } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function checkPricedServices() {
  try {
    const pricedServices = await db
      .select({
        id: services.id,
        name: services.name,
        basePrice: services.basePrice,
        isOnEnquiry: services.isOnEnquiry,
        businessName: detectives.businessName,
        category: services.category,
      })
      .from(services)
      .innerJoin(detectives, eq(services.detectiveId, detectives.id))
      .where(eq(services.isOnEnquiry, false));
    
    console.log(`Total services with prices: ${pricedServices.length}\n`);
    
    pricedServices.forEach(service => {
      console.log(`Detective: ${service.businessName}`);
      console.log(`Service: ${service.name}`);
      console.log(`Category: ${service.category}`);
      console.log(`Price: ₹${service.basePrice}`);
      console.log(`ID: ${service.id}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkPricedServices();
