import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Production safety guard
if (process.env.NODE_ENV === 'production' && process.env.CONFIRM_DELETE !== 'true') {
  console.error('❌ DELETE test cannot run in production. Set CONFIRM_DELETE=true if absolutely necessary.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

(async () => {
  try {
    console.log('📋 BEFORE: Categories in database\n');
    let result = await pool.query('SELECT id, name, slug FROM categories ORDER BY name');
    result.rows.forEach((cat, idx) => {
      console.log(`${idx + 1}. ${cat.name} (${cat.slug}) - ${cat.id.substring(0, 12)}...`);
    });

    console.log('\n🗑️  Deleting all categories...\n');
    const deleteResult = await pool.query('DELETE FROM categories RETURNING id, name');
    console.log(`Deleted ${deleteResult.rows.length} categories:`);
    deleteResult.rows.forEach(cat => console.log(`  - ${cat.name}`));

    console.log('\n📋 AFTER: Categories in database\n');
    result = await pool.query('SELECT id, name, slug FROM categories ORDER BY name');
    console.log(`Found ${result.rows.length} categories`);
    result.rows.forEach((cat, idx) => {
      console.log(`${idx + 1}. ${cat.name} (${cat.slug})`);
    });
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    } else {
      console.error('❌ Error:', String(error));
    }
  } finally {
    await pool.end();
  }
})();
