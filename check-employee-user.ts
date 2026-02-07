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
    console.log('Checking user sam@s.com...\n');
    const result = await pool.query('SELECT id, email, role, is_active FROM users WHERE email = $1', ['sam@s.com']);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ User found:');
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Active: ${user.is_active}`);
      console.log(`  ID: ${user.id}`);
    } else {
      console.log('❌ User not found. Please provide the password you used when creating this employee.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
})();
