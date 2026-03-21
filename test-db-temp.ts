import { db } from './db/index.js';
import { detectives } from './shared/schema.js';
import { count } from 'drizzle-orm';

async function main() {
  console.log('DB_URL:', process.env.DATABASE_URL?.substring(0, 50));
  try {
    const result = await db.select({ c: count(detectives.id) }).from(detectives);
    console.log('Count result:', JSON.stringify(result));
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR:', err.message, err.code);
    process.exit(1);
  }
}
main();
