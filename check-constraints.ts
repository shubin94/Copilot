import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function checkConstraints() {
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
  console.log(result.rows);
  
  process.exit(0);
}

checkConstraints();
