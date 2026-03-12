// One-time script to clean service slugs in the database by removing UUID prefixes
// Usage: node clean-service-slugs.mjs

import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function cleanServiceSlugs() {
  console.log('🔧 Cleaning service slugs (removing UUID prefixes)...');

  // Find all services with a UUID-prefixed slug
  const { rows } = await pool.query(`
    SELECT id, slug FROM services WHERE slug ~ '^[0-9a-fA-F-]{36}-'
  `);

  if (rows.length === 0) {
    console.log('✅ No slugs with UUID prefix found.');
    await pool.end();
    return;
  }

  let updated = 0;
  for (const { id, slug } of rows) {
    const cleanSlug = slug.replace(/^[0-9a-fA-F-]{36}-/, '');
    if (cleanSlug !== slug) {
      await pool.query(
        'UPDATE services SET slug = $1, updated_at = NOW() WHERE id = $2',
        [cleanSlug, id]
      );
      updated++;
      console.log(`Updated service ${id}: ${slug} → ${cleanSlug}`);
    }
  }

  console.log(`
✅ Slug cleaning complete. ${updated} service slugs updated.`);
  await pool.end();
}

cleanServiceSlugs().catch((err) => {
  console.error('❌ Error cleaning service slugs:', err);
  process.exit(1);
});
