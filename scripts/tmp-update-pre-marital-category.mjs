import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const sql = "update services set category = 'Pre-Marriage investigations' where category = 'Pre-marital investigations'";

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query(sql);
  console.log(JSON.stringify({ rowCount: result.rowCount }, null, 2));
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
