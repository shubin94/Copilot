import { pool } from './db/index.js';

async function testFinanceSummary() {
  console.log('=== Testing Finance Summary Queries ===\n');

  // Check raw data
  const rawData = await pool.query(`
    SELECT id, amount, currency, status, created_at 
    FROM payment_orders 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.log('Sample payment_orders:');
  console.log(rawData.rows);

  // Check by status
  const byStatus = await pool.query(`
    SELECT status, COUNT(*) as count, SUM(amount::numeric) as total_amount
    FROM payment_orders
    GROUP BY status
  `);
  console.log('\nGrouped by status:');
  console.log(byStatus.rows);

  // Test the exact query from admin-finance.ts
  const totalRevenueQuery = `
    SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
    FROM payment_orders
    WHERE status = 'completed'
  `;
  const totalRevenueResult = await pool.query(totalRevenueQuery);
  console.log('\nTotal revenue (completed only):');
  console.log(totalRevenueResult.rows[0]);

  // Try without status filter
  const allRevenue = await pool.query(`
    SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
    FROM payment_orders
  `);
  console.log('\nTotal revenue (all statuses):');
  console.log(allRevenue.rows[0]);

  // Check what statuses exist
  const statuses = await pool.query(`
    SELECT DISTINCT status FROM payment_orders
  `);
  console.log('\nDistinct statuses in payment_orders:');
  console.log(statuses.rows);

  await pool.end();
}

testFinanceSummary().catch(console.error);
