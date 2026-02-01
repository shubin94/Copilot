import { db } from "../db/index.ts";
import { serviceCategories } from "../shared/schema.ts";

async function checkCategories() {
  try {
    const categories = await db
      .select()
      .from(serviceCategories)
      .where({ isActive: true });

    console.log("\n=== ACTIVE CATEGORIES IN DATABASE ===");
    console.log(`Total: ${categories.length}\n`);
    
    categories.forEach((cat, idx) => {
      console.log(`${idx + 1}. "${cat.name}"`);
    });
    
    console.log("\n=== SEARCHING FOR MISSING PERSON CATEGORIES ===");
    const missingRelated = categories.filter(c => 
      c.name.toLowerCase().includes("missing") || 
      c.name.toLowerCase().includes("person")
    );
    
    if (missingRelated.length > 0) {
      console.log("Found:");
      missingRelated.forEach(cat => {
        console.log(`  - "${cat.name}"`);
      });
    } else {
      console.log("❌ NO categories found with 'missing' or 'person' in the name!");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkCategories();
