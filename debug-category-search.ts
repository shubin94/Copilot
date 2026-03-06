import './server/lib/loadEnv.ts';
import { pool } from './db/index.ts';
import { storage } from './server/storage.ts';

async function main() {
  try {
    console.log('=== DEBUGGING POPULAR SORT WITH CATEGORY FILTER ===\n');
    
    // Check what's in the materialized view
    console.log('1. Services in popular_service_per_detective view:');
    const viewResult = await pool.query(`
      SELECT psd.service_id, psd.detective_id, s.title, s.category, s.is_active
      FROM popular_service_per_detective psd
      JOIN services s ON s.id = psd.service_id
    `);
    console.log(JSON.stringify(viewResult.rows, null, 2));
    
    // Check all Pre-marriage services
    console.log('\n2. All Pre-marriage investigations services in database:');
    const allServicesResult = await pool.query(`
      SELECT id, title, category, is_active
      FROM services
      WHERE category = 'Pre-marriage investigations'
    `);
    console.log(JSON.stringify(allServicesResult.rows, null, 2));
    
    // Now test the search
    console.log('\n3. Search with category=Pre-marriage investigations, sortBy=popular:');
    const searchResults = await storage.searchServices({
      category: 'Pre-marriage investigations'
    }, 100, 0, 'popular');
    console.log(`Found: ${searchResults.length} services`);
    searchResults.forEach((s, i) => {
      console.log(`${i+1}. ${s.title}`);
    });
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
