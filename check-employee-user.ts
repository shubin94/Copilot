import pkg from 'pg';
import { loadEnv } from './server/lib/loadEnv.ts';
const { Pool } = pkg;

loadEnv();

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
      console.log('❌ User not found. Verify the email identifier (sam@s.com) or confirm the employee was created.');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Error:', String(error));
    }
  } finally {
    await pool.end();
  }
})();
