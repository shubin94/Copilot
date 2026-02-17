/**
 * Live Database Audit & Fix Script
 * 
 * Connects to production Supabase, checks schema, and adds missing tables/columns
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './shared/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}

console.log('🔍 Connecting to LIVE production database...\n');
console.log('URL:', DATABASE_URL.replace(/:[^:]*@/, ':****@')); // Mask password
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    ) as exists`,
    [tableName]
  );
  return result.rows[0]?.exists || false;
}

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name = $2
    ) as exists`,
    [tableName, columnName]
  );
  return result.rows[0]?.exists || false;
}

async function getTablepool.query(
    `SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows
  return result.map((row: any) => row.column_name);
}

async function auditDatabase() {
  console.log('📊 AUDITING PRODUCTION DATABASE\n');
  console.log('='.repeat(60));

  // Critical tables to check
  const criticalTables = [
    'detectives',
    'services', 
    'case_studies',
    'password_reset_tokens',
    'reviews',
    'users',
    'subscriptions'
  ];

  for (const table of criticalTables) {
    const exists = await checkTableExists(table);
    console.log(`\n📋 Table: ${table}`);
    console.log(`   Status: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (exists) {
      const columns = await getTableColumns(table);
      console.log(`   Columns (${columns.length}): ${columns.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

async function checkDetectivesTable() {
  console.log('\n🔎 CHECKING DETECTIVES TABLE DETAILS\n');
  
  const exists = await checkTableExists('detectives');
  if (!exists) {
    console.log('❌ detectives table does not exist!');
    return;
  }

  // Check critical columns
  const criticalColumns = [
    'id',
    'business_name',
    'slug',
    'country',
    'state', 
    'city',
    'subscription_id',
    'is_published'
  ];

  console.log('Checking critical columns:');
  for (const col of criticalColumns) {
    const exists = await checkColumnExists('detectives', col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check if slug trigger exists
  const triggerResult = await pool.query(
    `SELECT EXISTS (
      SELECT FROM pg_trigger 
      WHERE tgname = 'trg_generate_detective_slug'
    ) as exists`
  );
  console.log(`\nSlug Trigger: ${triggerResult.rows[0]?.exists ? '✅ EXISTS' : '❌ MISSING'}`);

  // Check if slug function exists
  const functionResult = await pool.query(
    `SELECT EXISTS (
      SELECT FROM pg_proc 
      WHERE proname = 'generate_detective_slug'
    ) as exists`
  );
  console.log(`Slug Function: ${functionResult.rows[0]?.exists ? '✅ EXISTS' : '❌ MISSING'}`);
}

async function addMissingTables() {
  console.log('\n🔧 CHECKING & ADDING MISSING TABLES\n');

  // Check case_studies table
  const caseStudiesExists = await checkTableExists('case_studies');
  if (!caseStudiesExists) {
    console.log('📝 Creating case_studies table...');
    await pool.query(
      `CREATE TABLE case_studies (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        excerpt_html TEXT,
        detective_id VARCHAR REFERENCES detectives(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'Investigation',
        featured BOOLEAN NOT NULL DEFAULT false,
        thumbnail TEXT,
        view_count INTEGER NOT NULL DEFAULT 0,
        published_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`
    );
    console.log('✅ case_studies table created');

    // Add indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS case_studies_slug_idx ON case_studies(slug)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS case_studies_detective_id_idx ON case_studies(detective_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS case_studies_category_idx ON case_studies(category)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS case_studies_published_at_idx ON case_studies(published_at)`);
    console.log('✅ case_studies indexes created');
  } else {
    console.log('✅ case_studies table already exists');
  }

  // Check password_reset_tokens table
  const passwordResetExists = await checkTableExists('password_reset_tokens');
  if (!passwordResetExists) {
    console.log('📝 Creating password_reset_tokens table...');
    await pool.query(
      `CREATE TABLE password_reset_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`
    );
    console.log('✅ password_reset_tokens table created');

    // Add indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens(expires_at)`);
    console.log('✅ password_reset_tokens indexes created');
  } else {
    console.log('✅ password_reset_tokens table already exists');
  }
}

async function addMissingColumns() {
  console.log('\n🔧 CHECKING & ADDING MISSING COLUMNS\n');

  // Check if slug exists in detectives
  const slugExists = await checkColumnExists('detectives', 'slug');
  if (!slugExists) {
    console.log('📝 Adding slug column to detectives...');
    await pool.query(`ALTER TABLE detectives ADD COLUMN slug VARCHAR(255)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_detective_slug ON detectives(slug)`);
    console.log('✅ slug column and index added');

    // Add trigger and function
    await pool.query(
      `CREATE OR REPLACE FUNCTION generate_detective_slug()
      RETURNS TRIGGER AS $$
      DECLARE
        v_base_slug VARCHAR(255);
      BEGIN
        v_base_slug := LOWER(
          REGEXP_REPLACE(
            CONCAT(NEW.business_name, ' ', COALESCE(NEW.city, 'services')),
            '[^a-z0-9]+',
            '-',
            'g'
          )
        );
        v_base_slug := TRIM(BOTH '-' FROM v_base_slug);
        
        IF NEW.slug IS NULL OR 
           (OLD.business_name IS DISTINCT FROM NEW.business_name) OR
           (OLD.city IS DISTINCT FROM NEW.city) THEN
          NEW.slug := v_base_slug;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;`
    );
    
    await pool.query(`DROP TRIGGER IF EXISTS trg_generate_detective_slug ON detectives`);
    await pool.query(
      `CREATE TRIGGER trg_generate_detective_slug
      BEFORE INSERT OR UPDATE ON detectives
      FOR EACH ROW
      EXECUTE FUNCTION generate_detective_slug()`
    );
    console.log('✅ slug trigger and function created');
  } else {
    console.log('✅ slug column already exists in detectives');
  }
}

async function main() {
  try {
    console.log('🚀 Starting Live Database Audit & Fix\n');
    
    // Step 1: Audit current state
    await auditDatabase();
    
    // Step 2: Check detectives table in detail
    await checkDetectivesTable();
    
    // Step 3: Add missing tables
    await addMissingTables();
    
    // Step 4: Add missing columns
    await addMissingColumns();
    
    console.log('\n✅ Database audit and fixes complete!');
    console.log('\nRe-running audit to verify...\n');
    
    // Step 5: Verify
    await auditDatabase();
    await checkDetectivesTable();
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

main();
