import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { detectives, detectiveVisibility } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function initializeVisibility() {
  try {
    console.log("🔄 Initializing visibility records for all detectives...");
    
    // Get all detectives
    const allDetectives = await db.select().from(detectives);
    console.log(`Found ${allDetectives.length} detectives`);
    
    let created = 0;
    let skipped = 0;
    
    for (const detective of allDetectives) {
      // Check if visibility record already exists
      const existing = await db
        .select()
        .from(detectiveVisibility)
        .where(eq(detectiveVisibility.detectiveId, detective.id))
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      // Create visibility record with safe defaults
      // Hidden by default unless explicitly enabled
      await db.insert(detectiveVisibility).values({
        detectiveId: detective.id,
        isVisible: detective.status === "active" ? true : false, // Only show active detectives
        isFeatured: false,
        manualRank: null,
        visibilityScore: 0,
      });
      
      created++;
      console.log(`✓ Created visibility record for ${detective.businessName}`);
    }
    
    console.log(`\n✅ Initialization complete!`);
    console.log(`   Created: ${created} new records`);
    console.log(`   Skipped: ${skipped} existing records`);
    console.log(`   Total: ${allDetectives.length} detectives`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing visibility:", error);
    process.exit(1);
  }
}

initializeVisibility();
