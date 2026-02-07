import "../server/lib/loadEnv.ts";
import { db, pool } from "./index.ts";
import { sql } from "drizzle-orm";

/**
 * Migration script to add page-based access control system
 * 
 * This script:
 * 1. Adds "employee" role to user_role enum
 * 2. Adds isActive column to users table for soft delete
 * 3. Creates access_pages table for page master list
 * 4. Creates user_pages table for many-to-many user↔page mappings
 */
async function migrateAccessControl() {
  const client = await pool.connect();

  try {
    console.log("🔄 Starting access control migration...");

    // Step 1: Add "employee" to user_role enum
    console.log("📝 Step 1: Adding 'employee' to user_role enum...");
    try {
      await client.query(`
        ALTER TYPE user_role ADD VALUE 'employee' BEFORE 'user'
      `);
      console.log("✅ Added 'employee' to user_role enum");
    } catch (enumError: any) {
      if (enumError.message?.includes("already exists")) {
        console.log("✅ 'employee' already exists in user_role enum");
      } else {
        throw enumError;
      }
    }

    // Step 2: Add isActive column to users table
    console.log("📝 Step 2: Adding isActive column to users table...");
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL
      `);
      console.log("✅ Added is_active column to users table");
    } catch (userColError: any) {
      if (userColError.message?.includes("already exists")) {
        console.log("✅ is_active column already exists on users table");
      } else {
        throw userColError;
      }
    }

    // Create index on is_active if it doesn't exist
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS users_is_active_idx 
        ON users(is_active)
      `);
      console.log("✅ Created index on users.is_active");
    } catch (indexError: any) {
      console.log("✅ Index on users.is_active already exists");
    }

    // Step 3: Create access_pages table
    console.log("📝 Step 3: Creating access_pages table...");
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS access_pages (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key VARCHAR UNIQUE NOT NULL,
          name VARCHAR NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      console.log("✅ Created access_pages table");
    } catch (tableError: any) {
      if (tableError.message?.includes("already exists")) {
        console.log("✅ access_pages table already exists");
      } else {
        throw tableError;
      }
    }

    // Create indexes on access_pages
    try {
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS access_pages_key_idx 
        ON access_pages(key)
      `);
      console.log("✅ Created unique index on access_pages.key");
    } catch (e) {
      console.log("✅ Index on access_pages.key already exists");
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS access_pages_is_active_idx 
        ON access_pages(is_active)
      `);
      console.log("✅ Created index on access_pages.is_active");
    } catch (e) {
      console.log("✅ Index on access_pages.is_active already exists");
    }

    // Step 4: Create user_pages table (many-to-many)
    console.log("📝 Step 4: Creating user_pages table...");
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_pages (
          user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          page_id VARCHAR NOT NULL REFERENCES access_pages(id) ON DELETE CASCADE,
          granted_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
          granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY (user_id, page_id)
        )
      `);
      console.log("✅ Created user_pages table");
    } catch (tableError: any) {
      if (tableError.message?.includes("already exists")) {
        console.log("✅ user_pages table already exists");
      } else {
        throw tableError;
      }
    }

    // Create indexes on user_pages
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS user_pages_user_id_idx 
        ON user_pages(user_id)
      `);
      console.log("✅ Created index on user_pages.user_id");
    } catch (e) {
      console.log("✅ Index on user_pages.user_id already exists");
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS user_pages_page_id_idx 
        ON user_pages(page_id)
      `);
      console.log("✅ Created index on user_pages.page_id");
    } catch (e) {
      console.log("✅ Index on user_pages.page_id already exists");
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS user_pages_granted_by_idx 
        ON user_pages(granted_by)
      `);
      console.log("✅ Created index on user_pages.granted_by");
    } catch (e) {
      console.log("✅ Index on user_pages.granted_by already exists");
    }

    console.log("✨ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

export default migrateAccessControl;

// Run if executed directly
if (import.meta.main) {
  migrateAccessControl()
    .then(() => {
      console.log("\n✅ Access control migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration failed:", error);
      process.exit(1);
    });
}
