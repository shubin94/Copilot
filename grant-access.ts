import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function grantAccess() {
  try {
    // Find sam@s.com
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['sam@s.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User sam@s.com not found');
      await pool.end();
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`✅ Found user: ${userResult.rows[0].email} (ID: ${userId})`);
    
    // Check current access
    const currentAccess = await pool.query(
      `SELECT ap.key, ap.name FROM user_pages up
       JOIN access_pages ap ON up.page_id = ap.id
       WHERE up.user_id = $1`,
      [userId]
    );
    
    console.log(`\nCurrent access (${currentAccess.rows.length} pages):`);
    if (currentAccess.rows.length === 0) {
      console.log('  ❌ NONE - No pages granted!');
    } else {
      currentAccess.rows.forEach(p => console.log(`  ✅ ${p.key}`));
    }
    
    // Get all available pages
    const pagesResult = await pool.query(
      'SELECT id, key, name FROM access_pages WHERE is_active = true ORDER BY key'
    );
    
    console.log(`\nAvailable pages (${pagesResult.rows.length}):`);
    pagesResult.rows.forEach(p => console.log(`  - ${p.key} (ID: ${p.id}): ${p.name}`));
    
    // Grant dashboard access if not already granted
    const dashboardPage = pagesResult.rows.find(p => p.key === 'dashboard');
    if (dashboardPage) {
      const hasAccess = currentAccess.rows.find(p => p.key === 'dashboard');
      if (!hasAccess) {
        await pool.query(
          'INSERT INTO user_pages (user_id, page_id) VALUES ($1, $2)',
          [userId, dashboardPage.id]
        );
        console.log(`\n✅ Granted dashboard access to sam@s.com`);
      } else {
        console.log(`\n✅ sam@s.com already has dashboard access`);
      }
    }
    
    // Grant cms access too
    const cmsPage = pagesResult.rows.find(p => p.key === 'cms');
    if (cmsPage) {
      const hasAccess = currentAccess.rows.find(p => p.key === 'cms');
      if (!hasAccess) {
        await pool.query(
          'INSERT INTO user_pages (user_id, page_id) VALUES ($1, $2)',
          [userId, cmsPage.id]
        );
        console.log(`✅ Granted cms access to sam@s.com`);
      } else {
        console.log(`✅ sam@s.com already has cms access`);
      }
    }
    
    // Show final access
    const finalAccess = await pool.query(
      `SELECT ap.key, ap.name FROM user_pages up
       JOIN access_pages ap ON up.page_id = ap.id
       WHERE up.user_id = $1`,
      [userId]
    );
    
    console.log(`\n📝 Final access for sam@s.com (${finalAccess.rows.length} pages):`);
    finalAccess.rows.forEach(p => console.log(`  ✅ ${p.key}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

grantAccess();
