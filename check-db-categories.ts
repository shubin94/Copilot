import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

(async () => {
  try {
    console.log('📋 Categories in database:\n');
    const result = await pool.query('SELECT id, name, slug, status FROM categories ORDER BY created_at DESC');
    
    if (result.rows.length === 0) {
      console.log('  No categories found.\n');
    } else {
      result.rows.forEach((cat, idx) => {
        console.log(`${idx + 1}. ${cat.name}`);
        console.log(`   slug: ${cat.slug}`);
        console.log(`   status: ${cat.status}`);
        console.log(`   id: ${cat.id.substring(0, 12)}...`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
})();
