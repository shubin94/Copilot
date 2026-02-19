import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const BATCH_SIZE = 100;

async function fixServiceDescriptions() {
  const client = await pool.connect();
  
  try {
    console.log("Fixing service descriptions automatically...\n");

    const result = await client.query(`
      SELECT 
        s.id as service_id,
        s.title as service_title,
        s.category as service_category,
        s.description as current_description,
        COALESCE(d.business_name, u.name) as detective_name
      FROM services s
      INNER JOIN detectives d ON s.detective_id = d.id
      INNER JOIN users u ON d.user_id = u.id
      WHERE s.description = 'Service from approved application'
      ORDER BY s.id
    `);

    console.log(`Found ${result.rows.length} services to update\n`);

    if (result.rows.length === 0) {
      console.log("No services to fix!");
      return;
    }

    // Show examples
    console.log("Example transformations:");
    for (let i = 0; i < Math.min(3, result.rows.length); i++) {
      const service = result.rows[i];
      const category = service.service_category || "investigation";
      const newDesc = `Professional ${category.toLowerCase()} services by ${service.detective_name}. Contact for detailed consultation.`;
      console.log(`\n${i + 1}. ${service.service_title}`);
      console.log(`   Detective: ${service.detective_name}`);
      console.log(`   Old: "${service.current_description}"`);
      console.log(`   New: "${newDesc}"`);
    }

    console.log(`\n\nProcessing ${result.rows.length} services in batches of ${BATCH_SIZE}...\n`);

    let totalUpdated = 0;
    let totalFailed = 0;
    let batchNumber = 1;
    const totalBatches = Math.ceil(result.rows.length / BATCH_SIZE);

    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      const batchEnd = Math.min(i + BATCH_SIZE, result.rows.length);
      
      console.log(`Processing Batch ${batchNumber}/${totalBatches} (${i + 1}-${batchEnd})...`);

      let batchUpdated = 0;
      let batchFailed = 0;

      for (const service of batch) {
        try {
          const category = service.service_category || "investigation";
          const detectiveName = service.detective_name;
          const newDescription = `Professional ${category.toLowerCase()} services by ${detectiveName}. Contact for detailed consultation.`;

          await client.query(
            `UPDATE services 
             SET description = $1, updated_at = NOW() 
             WHERE id = $2`,
            [newDescription, service.service_id]
          );

          batchUpdated++;
          totalUpdated++;
        } catch (error) {
          console.error(`❌ Failed service ${service.service_id}:`, error);
          batchFailed++;
          totalFailed++;
        }
      }

      console.log(`✅ Batch ${batchNumber}: Updated ${batchUpdated}, Failed ${batchFailed} | Total: ${totalUpdated}/${result.rows.length}\n`);
      batchNumber++;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ COMPLETE`);
    console.log(`${"=".repeat(60)}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   Total: ${result.rows.length}`);

  } finally {
    client.release();
    await pool.end();
  }
}

fixServiceDescriptions().catch(console.error);
