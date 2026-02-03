import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "./shared/schema.ts";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

async function checkSecrets() {
  const rows = await db.select().from(schema.appSecrets);
  
  console.log("\n📋 Current secrets in database:\n");
  rows.forEach(r => {
    const status = r.value && r.value.trim() ? '✅ SET' : '❌ EMPTY';
    console.log(`  ${r.key.padEnd(30)} ${status}`);
  });
  
  console.log("\n");
  await pool.end();
}

checkSecrets();
