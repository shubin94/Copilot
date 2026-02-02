import { db } from "./db/index.ts";
import { detectives, users } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function fixAllOrphanedDetectives() {
  const allDetectives = await db.select().from(detectives);
  
  console.log(`Total detectives: ${allDetectives.length}\n`);
  
  for (const detective of allDetectives) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, detective.userId),
    });
    
    if (!user) {
      console.log(`❌ ORPHANED: ${detective.businessName} (ID: ${detective.id})`);
      console.log(`   Deleting...`);
      await db.delete(detectives).where(eq(detectives.id, detective.id));
      console.log(`   ✅ Deleted\n`);
    } else {
      console.log(`✅ OK: ${detective.businessName} - User: ${user.email}\n`);
    }
  }
  
  const remaining = await db.select().from(detectives);
  console.log(`\nFinal count: ${remaining.length} detectives`);
  remaining.forEach((d, i) => {
    console.log(`${i + 1}. ${d.businessName} - ${d.status}`);
  });
  
  process.exit(0);
}

fixAllOrphanedDetectives();
