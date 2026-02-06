import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.gjgrwxxtkyggwfrydpdb:AKshubin123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
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
      rows.forEach(r => {
        console.log(`  ${r.email}`);
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
