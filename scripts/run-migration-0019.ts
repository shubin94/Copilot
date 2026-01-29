import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');

    // First, check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'detectives' 
      AND column_name IN ('state', 'city');
    `;
    
    const existingColumns = await client.query(checkQuery);
    console.log('\nExisting state/city columns:', existingColumns.rows);

    // Read and execute migration
    const migrationPath = join(__dirname, '..', 'migrations', '0019_add_state_city_to_detectives.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('\nExecuting migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully');

    // Verify columns were added
    const verifyQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'detectives' 
      AND column_name IN ('state', 'city', 'country', 'location');
    `;
    
    const result = await client.query(verifyQuery);
    console.log('\n✅ Current location-related columns in detectives table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
