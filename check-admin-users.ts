import "./server/lib/loadEnv.ts";
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? true
    : process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

async function checkAdminUsers() {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role FROM users WHERE role='admin' OR email LIKE '%admin%' LIMIT 20`
    );
    
    console.log('\n📋 Users with admin role:\n');
    if (rows.length === 0) {
      console.log('  ❌ NO ADMIN USERS FOUND!\n');
    } else {
      const showPii = process.argv.includes('--show-pii');
      rows.forEach(r => {
        const maskedEmail = showPii ? r.email : r.email.replace(/^(.).+(@.+)$/, '$1***$2');
        console.log(`  ${maskedEmail}`);
        console.log(`    ID: ${r.id}`);
        console.log(`    Role: ${r.role}`);
      });
    }
    
    // Also check all unique roles
    const { rows: roles } = await pool.query(
      `SELECT DISTINCT role, COUNT(*) as count FROM users GROUP BY role`
    );
    console.log('\n📊 All roles in system:\n');
    roles.forEach(r => console.log(`  ${r.role}: ${r.count} users`));
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdminUsers();
