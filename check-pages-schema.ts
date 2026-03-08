import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

async function checkSchema() {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pages' 
    ORDER BY ordinal_position
  `);
  
  console.log("Pages table columns:");
  console.log(JSON.stringify(result.rows, null, 2));
  
  await pool.end();
}

checkSchema().catch(console.error);
