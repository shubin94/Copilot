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
    const categoryId = 'f6baad3e-ff8';
    
    console.log(`🗑️  Attempting to delete category with ID starting with: ${categoryId}...\n`);
    
    // First, find the full ID
    const findResult = await pool.query(
      'SELECT id, name, slug, status FROM categories WHERE id::text LIKE $1',
      [`${categoryId}%`]
    );
    
    if (findResult.rows.length === 0) {
      console.log('❌ Category not found.');
      return;
    }
    
    const cat = findResult.rows[0];
    console.log(`Found category:`);
    console.log(`  Name: ${cat.name}`);
    console.log(`  Slug: ${cat.slug}`);
    console.log(`  Status: ${cat.status}`);
    console.log(`  Full ID: ${cat.id}\n`);
    
    // Check if it has any pages
    const pagesCheck = await pool.query(
      'SELECT COUNT(*) as count FROM pages WHERE category_id = $1',
      [cat.id]
    );
    
    const pageCount = parseInt(pagesCheck.rows[0].count);
    if (pageCount > 0) {
      console.log(`❌ Cannot delete: ${pageCount} page(s) still associated with this category.`);
      return;
    }
    
    console.log(`✅ No pages associated with this category.`);
    console.log(`🗑️  Deleting...`);
    
    // Delete it
    const deleteResult = await pool.query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [cat.id]
    );
    
    if (deleteResult.rows.length > 0) {
      console.log(`✅ Category deleted successfully!\n`);
    } else {
      console.log(`❌ Delete failed.\n`);
    }
    
    // Show remaining categories
    const remaining = await pool.query('SELECT name, slug FROM categories');
    console.log(`📋 Remaining categories: ${remaining.rows.length}`);
    remaining.rows.forEach(c => console.log(`  - ${c.name} (slug: ${c.slug})`));
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', errorMessage);
  } finally {
    await pool.end();
  }
})();
