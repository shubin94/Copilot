import "dotenv/config";
import pkg from "pg";
import * as readline from "readline";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const BATCH_SIZE = 100; // Process 100 services at a time

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

async function fixServiceDescriptions() {
  const client = await pool.connect();
  
  try {
    console.log("Fixing service descriptions in batches...\n");

    // Get all services with the incorrect description along with detective info
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

    // Show a few examples before starting
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

    console.log(`\n\nWill process ${result.rows.length} services in batches of ${BATCH_SIZE}\n`);

    let totalUpdated = 0;
    let totalFailed = 0;
    let batchNumber = 1;
    const totalBatches = Math.ceil(result.rows.length / BATCH_SIZE);

    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      const batchEnd = Math.min(i + BATCH_SIZE, result.rows.length);
      
      console.log(`\n${"=".repeat(60)}`);
      console.log(`BATCH ${batchNumber}/${totalBatches}: Services ${i + 1} to ${batchEnd}`);
      console.log(`${"=".repeat(60)}`);

      // Ask for confirmation before processing each batch
      const answer = await askQuestion(`\nProcess this batch? (y/n/q to quit): `);
      
      if (answer.toLowerCase() === 'q') {
        console.log("\n⏸️  Stopped by user");
        break;
      }
      
      if (answer.toLowerCase() !== 'y') {
        console.log("⏭️  Skipping batch...");
        batchNumber++;
        continue;
      }

      let batchUpdated = 0;
      let batchFailed = 0;

      for (const service of batch) {
        try {
          const category = service.service_category || "investigation";
          const detectiveName = service.detective_name;

          // Build new description using the same template as auto-create
          const newDescription = `Professional ${category.toLowerCase()} services by ${detectiveName}. Contact for detailed consultation.`;

          // Update the service
          await client.query(
            `UPDATE services 
             SET description = $1, updated_at = NOW() 
             WHERE id = $2`,
            [newDescription, service.service_id]
          );

          batchUpdated++;
          totalUpdated++;
        } catch (error) {
          console.error(`❌ Failed to update service ${service.service_id}:`, error);
          batchFailed++;
          totalFailed++;
        }
      }

      console.log(`\n✅ Batch ${batchNumber} complete:`);
      console.log(`   Updated: ${batchUpdated}`);
      console.log(`   Failed: ${batchFailed}`);
      console.log(`   Total progress: ${totalUpdated}/${result.rows.length}`);

      batchNumber++;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ FINAL SUMMARY`);
    console.log(`${"=".repeat(60)}`);
    console.log(`   Total Updated: ${totalUpdated}`);
    console.log(`   Total Failed: ${totalFailed}`);
    console.log(`   Total Services: ${result.rows.length}`);
    console.log(`   Remaining: ${result.rows.length - totalUpdated - totalFailed}`);

  } finally {
    client.release();
    await pool.end();
  }
}

fixServiceDescriptions().catch(console.error);
