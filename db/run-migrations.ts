import { db } from './index';
import { sql } from 'drizzle-orm';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');

/**
 * Run all SQL migrations in order
 */
export async function runMigrations() {
  try {
    console.log('🚀 Starting migrations...\n');

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
      const [existing] = await db.execute<{ filename: string }>(
        sql`SELECT filename FROM _migrations WHERE filename = ${file}`
      );

      if (existing?.filename) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`📝 Running migration: ${file}`);
      
      // Read and execute migration
      const migrationSQL = readFileSync(join(migrationsDir, file), 'utf-8');
      
      try {
        await db.execute(sql.raw(migrationSQL));
        
        // Mark as executed
        await db.execute(
          sql`INSERT INTO _migrations (filename) VALUES (${file})`
        );
        
        console.log(`✅ Completed ${file}\n`);
        executedCount++;
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
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.includes(process.argv[1])) {
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
