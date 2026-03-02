import './server/lib/loadEnv.ts';
import { pool } from './db/index.ts';

async function main() {
  try {
    console.log('Checking exact category names in database...\n');
    
    const result = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM services
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY category
    `);
    
    console.log('Categories in database:');
    result.rows.forEach((row: any) => {
      console.log(`  "${row.category}" (${row.count} services)`);
    });
    
    console.log('\nSearching for "Pre-marriage investigations" (exact match):');
    const exact = await pool.query(`
      SELECT id, title, category, is_active
      FROM services
      WHERE category = 'Pre-marriage investigations'
    `);
    console.log(`Found: ${exact.rows.length} services`);
    
    console.log('\nSearching with LOWER comparison:');
    const lower = await pool.query(`
      SELECT id, title, category, is_active
      FROM services
      WHERE LOWER(category) = LOWER('Pre-marriage investigations')
    `);
    console.log(`Found: ${lower.rows.length} services`);
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
