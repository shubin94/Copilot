import "dotenv/config";
import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function checkSessionTable() {
  try {
    console.log("🔍 Checking for session table...");
    
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'session'
      );
    `);
    
    console.log("Result:", result);
    
    if (result.rows[0]?.exists) {
      console.log("✅ Session table exists");
      
      const count = await db.execute(sql`SELECT COUNT(*) FROM session`);
      console.log(`   Sessions stored: ${count.rows[0]?.count || 0}`);
    } else {
      console.log("❌ Session table DOES NOT EXIST");
      console.log("\n🔧 Fix: Start your server once to auto-create the session table");
      console.log("   Or run: npm run dev");
    }
  } catch (error: any) {
    console.error("❌ Error checking session table:", error.message);
    console.log("\n💡 This is likely why CSRF tokens are failing!");
  } finally {
    process.exit(0);
  }
}

checkSessionTable();
