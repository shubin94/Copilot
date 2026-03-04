import "../server/lib/loadEnv.js";
import { db, pool } from './index.js';
import { sql } from 'drizzle-orm';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');

/**
 * Run all SQL migrations in order
 * 
 * IMPORTANT: Some migrations use CREATE INDEX CONCURRENTLY which cannot run inside
 * a transaction. These are detected and executed outside transaction blocks.
 */
export async function runMigrations() {
  try {
    console.log('🚀 Starting migrations...\n');

    // Check if migrations directory exists
    if (!existsSync(migrationsDir)) {
      console.log('ℹ️  Migrations directory does not exist, skipping migrations');
      return;
    }

    // Create migrations tracking table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get all SQL migration files
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files\n`);

    let executedCount = 0;
    for (const file of files) {
      // Check if migration was already executed
      const results = await db.execute(
        sql`SELECT filename FROM _migrations WHERE filename = ${file}`
      );
      const existing = (results as any).rows && (results as any).rows.length > 0 ? (results as any).rows[0] : null;

      if (existing?.filename) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`📝 Running migration: ${file}`);
      
      // Read migration SQL
      const migrationSQL = readFileSync(join(migrationsDir, file), 'utf-8');
      
      // Check if migration contains CREATE INDEX CONCURRENTLY (must run outside transaction)
      const hasConcurrentIndex = /CREATE\s+INDEX\s+CONCURRENTLY/i.test(migrationSQL);
      
      try {
        if (hasConcurrentIndex) {
          // Execute outside transaction using raw pool connection (required for CREATE INDEX CONCURRENTLY)
          console.log(`  ⚠️  Contains CONCURRENT INDEX - executing outside transaction`);
          
          // Split SQL by statements but keep them together for concurrent index creation
          // We'll use the raw pool.query() to bypass Drizzle's transaction wrapping
          const client = await pool.connect();
          try {
            // Execute raw SQL directly (outside transaction)
            await client.query(migrationSQL);
          } finally {
            client.release();
          }
          
          // Mark as executed separately using Drizzle (safe single query)
          await db.execute(sql`INSERT INTO _migrations (filename) VALUES (${file})`);
        } else {
          // Use transaction for atomicity (normal migrations)
          await db.transaction(async (tx) => {
            // Execute migration SQL
            await tx.execute(sql.raw(migrationSQL));
            
            // Mark as executed in same transaction
            await tx.execute(sql`INSERT INTO _migrations (filename) VALUES (${file})`);
          });
        }
        
        console.log(`✅ Completed ${file}\n`);
        executedCount++;
      } catch (error) {
        // Handle idempotent errors (e.g., type already exists, index already exists)
        const errorCode = (error as any)?.code;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // 42710 = type already exists
        // 42P07 = duplicate table
        // 42P13 = duplicate index
        const isIdempotent = errorCode === '42710' || errorCode === '42P07' || errorCode === '42P13' || 
                            errorMessage.includes('already exists') ||
                            errorMessage.includes('duplicate key');
        
        if (isIdempotent) {
          console.warn(`⚠️  Skipping ${file}: already applied (${errorMessage.slice(0, 60)}...)`);
          
          // Still mark as executed to prevent re-running
          try {
            await db.execute(sql`INSERT INTO _migrations (filename) VALUES (${file})`);
          } catch (_) {
            // Ignore if already marked
          }
          console.log(`✅ Marked as executed\n`);
        } else {
          console.error(`❌ Failed to execute ${file}:`, error);
          throw error;
        }
      }
    }

    if (executedCount > 0) {
      console.log(`🎉 Executed ${executedCount} new migration(s) successfully!`);
    } else {
      console.log('✅ All migrations already applied');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = resolve(process.argv[1]) === resolve(__filename);

if (isMainModule) {
  runMigrations()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}
