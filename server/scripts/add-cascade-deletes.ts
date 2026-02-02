import { db } from "../../db/index.ts";
import { sql } from "drizzle-orm";

/**
 * Migration: Add CASCADE DELETE to detective-related foreign keys
 * This ensures when a detective is deleted, all related records are automatically removed
 */
async function migrate() {
  console.log("Starting migration: Add CASCADE DELETE constraints...");

  try {
    // Drop existing foreign key constraints
    console.log("Dropping existing constraints...");
    await db.execute(sql`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_detective_id_detectives_id_fk`);
    await db.execute(sql`ALTER TABLE profile_claims DROP CONSTRAINT IF EXISTS profile_claims_detective_id_detectives_id_fk`);
    await db.execute(sql`ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_detective_id_detectives_id_fk`);

    // Recreate with CASCADE DELETE
    console.log("Adding CASCADE DELETE constraints...");
    await db.execute(sql`
      ALTER TABLE orders 
        ADD CONSTRAINT orders_detective_id_detectives_id_fk 
        FOREIGN KEY (detective_id) REFERENCES detectives(id) ON DELETE CASCADE
    `);

    await db.execute(sql`
      ALTER TABLE profile_claims 
        ADD CONSTRAINT profile_claims_detective_id_detectives_id_fk 
        FOREIGN KEY (detective_id) REFERENCES detectives(id) ON DELETE CASCADE
    `);

    await db.execute(sql`
      ALTER TABLE payment_orders 
        ADD CONSTRAINT payment_orders_detective_id_detectives_id_fk 
        FOREIGN KEY (detective_id) REFERENCES detectives(id) ON DELETE CASCADE
    `);

    console.log("✅ Migration completed successfully!");
    console.log("Detective deletion will now properly cascade to:");
    console.log("  - orders");
    console.log("  - profile_claims");
    console.log("  - payment_orders");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
