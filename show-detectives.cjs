const pg = require('pg');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
});

async function getDetectives() {
  try {
    await client.connect();
    
    console.log("📋 All detectives in database:\n");
    
    const result = await client.query(
      `SELECT 
        id, 
        business_name, 
        slug, 
        country, 
        state, 
        city
      FROM detectives
      ORDER BY created_at DESC
      LIMIT 15`
    );

    if (result.rows.length === 0) {
      console.log("❌ No detectives found");
      await client.end();
      process.exit(1);
    }
    
    result.rows.forEach((det, idx) => {
      console.log(`${idx + 1}. ${det.business_name}`);
      console.log(`   ID: ${det.id}`);
      console.log(`   Location: ${det.city || 'N/A'}, ${det.state || 'N/A'}, ${det.country || 'N/A'}`);
      console.log(`   Slug (DB): ${det.slug || 'NULL'}`);
      console.log();
    });
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

getDetectives();
