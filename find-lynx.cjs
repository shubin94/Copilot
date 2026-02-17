const pg = require('pg');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
});

async function findDetectives() {
  try {
    await client.connect();
    
    console.log("Getting all detectives with location info...\n");
    
    const result = await client.query(
      `SELECT 
        d.id, 
        d.business_name, 
        d.slug as detective_slug, 
        d.country, 
        d.state, 
        d.city,
        c.slug as country_slug,
        s.slug as state_slug,
        ct.slug as city_slug
      FROM detectives d
      LEFT JOIN countries c ON c.code = d.country
      LEFT JOIN states s ON s.id = d.state_id
      LEFT JOIN cities ct ON ct.id = d.city_id
      ORDER BY d.created_at DESC
      LIMIT 10`
    );

    if (result.rows.length === 0) {
      console.log("❌ No detectives found");
      await client.end();
      process.exit(1);
    }

    console.log("✅ Found detectives with ACTUAL slugs:\n");
    
    result.rows.forEach((detective, idx) => {
      console.log(`${idx + 1}. ${detective.business_name}`);
      console.log(`   ID: ${detective.id}`);
      console.log(`   Location: ${detective.city}, ${detective.state}, ${detective.country}`);
      console.log(`   Detective Slug (DB): ${detective.detective_slug}`);
      console.log(`   Country Slug: ${detective.country_slug}`);
      console.log(`   State Slug: ${detective.state_slug}`);
      console.log(`   City Slug: ${detective.city_slug}`);
      
      // Construct URL with ACTUAL slugs
      const countrySlug = detective.country_slug || detective.country.toLowerCase().replace(/\s+/g, '-');
      const stateSlug = detective.state_slug || detective.state.toLowerCase().replace(/\s+/g, '-');
      const citySlug = detective.city_slug || detective.city.toLowerCase().replace(/\s+/g, '-');
      const businessSlug = detective.detective_slug || detective.business_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      
      const url = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/${businessSlug}/`;
      console.log(`   \n   📍 REAL URL: ${url}`);
      console.log(`   Local: http://localhost:5000/detectives/${countrySlug}/${stateSlug}/${citySlug}/${businessSlug}/\n`);
    });
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

findDetectives();
