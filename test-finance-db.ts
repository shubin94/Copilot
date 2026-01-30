import "dotenv/config";
import { pool } from "./db/index.ts";

async function main() {
  console.log("Checking payment_orders table...\n");
  
  try {
    // Check total transactions
    const countResult = await pool.query("SELECT COUNT(*) as total FROM payment_orders");
    console.log(`✅ Total transactions in database: ${countResult.rows[0].total}`);
    
    // Get sample transactions
    const transactionsResult = await pool.query(`
      SELECT 
        po.id,
        po.detective_id,
        po.amount,
        po.currency,
        po.status,
        po.provider,
        po.plan,
        po.created_at,
        d.business_name,
        d.name
      FROM payment_orders po
      LEFT JOIN detectives d ON po.detective_id = d.id
      ORDER BY po.created_at DESC
      LIMIT 5
    `);
    
    console.log("\n📋 Sample transactions:");
    transactionsResult.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Transaction ${row.id.substring(0, 8)}`);
      console.log(`   Detective: ${row.business_name || row.name || 'N/A'}`);
      console.log(`   Amount: ${row.currency} ${row.amount}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Provider: ${row.provider || 'N/A'}`);
      console.log(`   Date: ${row.created_at}`);
    });
    
    // Check if detective_id references exist
    const orphanedCheck = await pool.query(`
      SELECT COUNT(*) as orphaned
      FROM payment_orders po
      LEFT JOIN detectives d ON po.detective_id = d.id
      WHERE d.id IS NULL
    `);
    console.log(`\n⚠️  Orphaned transactions (no detective match): ${orphanedCheck.rows[0].orphaned}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
