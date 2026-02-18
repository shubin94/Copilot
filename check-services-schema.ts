import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function checkSchema() {
  try {
    console.log("\n📋 SERVICES TABLE SCHEMA:\n");

    const schema = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'services'
      ORDER BY ordinal_position
    `);

    schema.rows.forEach((row: any) => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log("\n📋 SERVICES TABLE DATA (first 3 records):\n");
    const data = await db.execute(sql`SELECT * FROM services LIMIT 3`);
    console.log(JSON.stringify(data.rows, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

checkSchema();
