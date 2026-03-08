import "./server/lib/loadEnv.js";
import { db, pool } from "./db/index.ts";
import { sql } from 'drizzle-orm';

async function addUpdatedAtColumns() {
  try {
    console.log('Adding updated_at columns to location tables...');
    
    // Add updated_at to countries
    await db.execute(sql`
      ALTER TABLE countries 
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL
    `);
    console.log('✓ Added updated_at to countries');
    
    // Add updated_at to states
    await db.execute(sql`
      ALTER TABLE states 
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL
    `);
    console.log('✓ Added updated_at to states');
    
    // Add updated_at to cities
    await db.execute(sql`
      ALTER TABLE cities 
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL
    `);
    console.log('✓ Added updated_at to cities');
    
    console.log('\n✅ All updated_at columns added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding updated_at columns:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addUpdatedAtColumns();
