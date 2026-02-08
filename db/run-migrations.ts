import "./server/lib/loadEnv.ts";
import { db } from './index';
import { sql } from 'drizzle-orm';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');

/**
 * Run all SQL migrations in order
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
      
      // Read and execute migration  
      const migrationSQL = readFileSync(join(migrationsDir, file), 'utf-8');
      
      try {
        // Wrap migration + tracking in transaction
        await db.execute(sql`BEGIN`);
        try {
          await db.execute(sql.raw(migrationSQL));
          
          // Mark as executed
          await db.execute(
            sql`INSERT INTO _migrations (filename) VALUES (${file})`
          );
          
          await db.execute(sql`COMMIT`);
          console.log(`✅ Completed ${file}\n`);
          executedCount++;
        } catch (error) {
          await db.execute(sql`ROLLBACK`);
          throw error;
        }
      } catch (error) {
        console.error(`❌ Failed to execute ${file}:`, error);
        throw error;
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
