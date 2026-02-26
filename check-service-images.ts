import { db } from "./db/index.ts";
import { services } from "./shared/schema.ts";
import { sql } from "drizzle-orm";

async function checkServiceImages() {
  try {
    console.log("🔍 Checking services and their images...\n");

    const allServices = await db.select({
      id: services.id,
      title: services.title,
      imageCount: sql<number>`array_length(${services.images}, 1)`,
      images: services.images,
    }).from(services).limit(5);

    console.log(`Found ${allServices.length} services:\n`);

    for (const service of allServices) {
      console.log(`📦 Service: ${service.title} (ID: ${service.id})`);
      console.log(`   Image count: ${service.imageCount || 0}`);
      
      if (service.images && Array.isArray(service.images)) {
        console.log(`   Images:`);
        service.images.forEach((img: string, idx: number) => {
          const preview = img.substring(0, 100) + (img.length > 100 ? '...' : '');
          const isSupabase = img.includes('.supabase.co');
          const isBase64 = img.startsWith('data:');
          console.log(`   [${idx}] ${preview}`);
          console.log(`      └─ Supabase: ${isSupabase}, Base64: ${isBase64}`);
        });
      }
      console.log();
    }

  } catch (error) {
    console.error("❌ Error checking services:", error);
  }

  process.exit(0);
}

checkServiceImages();
