/**
 * COMPLETE Database Audit & Fix Script
 * 
 * Checks ALL 29 tables from schema.ts and creates missing ones
 * SAFE: Only ADDS tables/columns, NEVER deletes data
 */

import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}

console.log('🔍 Connecting to LIVE production database...\n');
console.log('URL:', DATABASE_URL.replace(/:[^:]*@/, ':****@'));
const pool = new Pool({ connectionString: DATABASE_URL });

// ALL 29 tables from schema.ts
const ALL_TABLES = [
  'users',
  'detectives',
  'case_studies',
  'service_categories',
  'services',
  'service_packages',
  'reviews',
  'orders',
  'favorites',
  'detective_applications',
  'profile_claims',
  'billing_history',
  'session',
  'site_settings',
  'countries',
  'states',
  'cities',
  'search_stats',
  'app_policies',
  'app_secrets',
  'subscription_plans',
  'payment_orders',
  'detective_visibility',
  'claim_tokens',
  'password_reset_tokens',
  'email_templates',
  'detective_snippets',
  'access_pages',
  'user_pages'
];

async function checkTableExists(tableName) {
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

async function getTableColumns(tableName) {
  const result = await pool.query(
    `SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
}

async function auditAllTables() {
  console.log('📊 COMPLETE DATABASE AUDIT - ALL 29 TABLES\n');
  console.log('='.repeat(70));

  const existing = [];
  const missing = [];

  for (const table of ALL_TABLES) {
    const exists = await checkTableExists(table);
    
    if (exists) {
      const columns = await getTableColumns(table);
      existing.push({ table, columnCount: columns.length });
      console.log(`✅ ${table.padEnd(30)} (${columns.length} columns)`);
    } else {
      missing.push(table);
      console.log(`❌ ${table.padEnd(30)} MISSING`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\nSummary: ${existing.length} tables exist, ${missing.length} missing\n`);
  
  return { existing, missing };
}

async function createMissingTable(tableName) {
  console.log(`\n📝 Creating table: ${tableName}`);
  
  // Table creation SQL (based on schema.ts definitions)
  const tableDefinitions = {
    service_categories: `
      CREATE TABLE service_categories (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT,
        parent_id VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    service_packages: `
      CREATE TABLE service_packages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        service_id VARCHAR REFERENCES services(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        price NUMERIC(10,2) NOT NULL,
        features JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    orders: `
      CREATE TABLE orders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        detective_id VARCHAR REFERENCES detectives(id) ON DELETE CASCADE,
        service_id VARCHAR REFERENCES services(id) ON DELETE SET NULL,
        package_id VARCHAR REFERENCES service_packages(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        total_amount NUMERIC(10,2) NOT NULL,
        payment_status TEXT,
        payment_method TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    favorites: `
      CREATE TABLE favorites (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        detective_id VARCHAR NOT NULL REFERENCES detectives(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(user_id, detective_id)
      )`,
    
    detective_applications: `
      CREATE TABLE detective_applications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        business_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        location TEXT,
        country TEXT,
        state TEXT,
        city TEXT,
        license_number TEXT,
        years_experience INTEGER,
        bio TEXT,
        business_type TEXT,
        business_documents TEXT[],
        identity_documents TEXT[],
        status TEXT NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        admin_notes TEXT,
        submitted_at TIMESTAMP NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMP,
        reviewed_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    profile_claims: `
      CREATE TABLE profile_claims (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        detective_id VARCHAR NOT NULL REFERENCES detectives(id) ON DELETE CASCADE,
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        phone TEXT,
        identity_documents TEXT[],
        business_documents TEXT[],
        status TEXT NOT NULL DEFAULT 'pending',
        verification_code TEXT,
        notes TEXT,
        submitted_at TIMESTAMP NOT NULL DEFAULT now(),
        verified_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    billing_history: `
      CREATE TABLE billing_history (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        detective_id VARCHAR NOT NULL REFERENCES detectives(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        currency TEXT DEFAULT 'INR',
        transaction_type TEXT NOT NULL,
        payment_method TEXT,
        payment_id TEXT,
        status TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    session: `
      CREATE TABLE session (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS session_expire_idx ON session(expire)`,
    
    site_settings: `
      CREATE TABLE site_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    countries: `
      CREATE TABLE countries (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        iso_code TEXT,
        phone_code TEXT,
        currency TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    states: `
      CREATE TABLE states (
        id SERIAL PRIMARY KEY,
        country_id INTEGER REFERENCES countries(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        code TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(country_id, slug)
      )`,
    
    cities: `
      CREATE TABLE cities (
        id SERIAL PRIMARY KEY,
        state_id INTEGER REFERENCES states(id) ON DELETE CASCADE,
        country_id INTEGER REFERENCES countries(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(state_id, slug)
      )`,
    
    search_stats: `
      CREATE TABLE search_stats (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        search_term TEXT NOT NULL,
        search_type TEXT,
        result_count INTEGER DEFAULT 0,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS search_stats_term_idx ON search_stats(search_term);
      CREATE INDEX IF NOT EXISTS search_stats_created_idx ON search_stats(created_at)`,
    
    app_policies: `
      CREATE TABLE app_policies (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        type TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    app_secrets: `
      CREATE TABLE app_secrets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    subscription_plans: `
      CREATE TABLE subscription_plans (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        price NUMERIC(10,2) NOT NULL,
        billing_cycle TEXT NOT NULL,
        features JSONB,
        service_limit INTEGER,
        is_active BOOLEAN DEFAULT true,
        is_popular BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    payment_orders: `
      CREATE TABLE payment_orders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        detective_id VARCHAR REFERENCES detectives(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        currency TEXT DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'created',
        payment_gateway TEXT,
        gateway_order_id TEXT,
        gateway_payment_id TEXT,
        payment_method TEXT,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    detective_visibility: `
      CREATE TABLE detective_visibility (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        detective_id VARCHAR NOT NULL REFERENCES detectives(id) ON DELETE CASCADE,
        is_visible BOOLEAN DEFAULT true,
        hide_reason TEXT,
        hidden_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        hidden_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(detective_id)
      )`,
    
    claim_tokens: `
      CREATE TABLE claim_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        detective_id VARCHAR NOT NULL REFERENCES detectives(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        claimed_at TIMESTAMP,
        claimed_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS claim_tokens_expires_idx ON claim_tokens(expires_at)`,
    
    email_templates: `
      CREATE TABLE email_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL UNIQUE,
        subject TEXT NOT NULL,
        html_content TEXT NOT NULL,
        text_content TEXT,
        variables JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    detective_snippets: `
      CREATE TABLE detective_snippets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        detective_id VARCHAR NOT NULL REFERENCES detectives(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        snippet_type TEXT,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    access_pages: `
      CREATE TABLE access_pages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        meta_title TEXT,
        meta_description TEXT,
        is_published BOOLEAN DEFAULT false,
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
    
    user_pages: `
      CREATE TABLE user_pages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        meta_title TEXT,
        meta_description TEXT,
        is_published BOOLEAN DEFAULT false,
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`
  };

  const sql = tableDefinitions[tableName];
  
  if (!sql) {
    console.log(`⚠️  No definition found for ${tableName} - skipping`);
    return false;
  }

  try {
    await pool.query(sql);
    console.log(`✅ Table ${tableName} created successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create ${tableName}:`, error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Starting COMPLETE Database Audit & Fix\n');
    
    // Step 1: Audit ALL tables
    const { existing, missing } = await auditAllTables();
    
    if (missing.length === 0) {
      console.log('🎉 All tables exist! Database is complete.');
    } else {
      console.log(`\n🔧 Creating ${missing.length} missing tables...\n`);
      
      let created = 0;
      for (const tableName of missing) {
        const success = await createMissingTable(tableName);
        if (success) created++;
      }
      
      console.log(`\n✅ Created ${created} out of ${missing.length} tables`);
      
      // Re-audit to verify
      console.log('\n📊 Re-auditing to verify...\n');
      await auditAllTables();
    }
    
    console.log('\n✅ Database audit complete!');
    console.log('⚠️  NO DATA WAS DELETED - Only tables were added');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

main();
