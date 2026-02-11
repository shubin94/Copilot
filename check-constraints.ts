import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function checkConstraints() {
  try {
    const result = await db.execute(sql`
      SELECT 
        con.conname AS constraint_name,
        con.confdeltype AS delete_action
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'services' 
      AND con.contype = 'f'
      AND con.conname LIKE '%detective%';
    `);
    
    console.log("Services table foreign key constraints:");
    console.log((result as any).rows || result);
    process.exitCode = 0;
  } catch (error) {
    console.error("Error checking constraints:", error);
    process.exitCode = 1;
  } finally {
    // Close database connection properly
    if ((db as any).end) {
      await (db as any).end();
    }
    process.exit(process.exitCode);
  }
}

checkConstraints();
