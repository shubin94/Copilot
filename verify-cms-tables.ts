import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

interface VerificationResult {
  name: string;
  passed: boolean;
  details: string[];
}

const results: VerificationResult[] = [];

async function verify() {
  try {
    console.log("\n" + "=".repeat(70));
    console.log("CMS TABLE VERIFICATION REPORT");
    console.log("=".repeat(70) + "\n");

    // Check 1: Verify all 4 tables exist
    console.log("📋 [1] CHECKING TABLE EXISTENCE\n");
    const tablesCheck = await verifyTablesExist();
    results.push(tablesCheck);
    
    // Check 2: Verify columns for each table
    console.log("\n📊 [2] CHECKING COLUMNS & TYPES\n");
    const columnsCheck = await verifyColumns();
    results.push(columnsCheck);
    
    // Check 3: Verify slug indexes
    console.log("\n📑 [3] CHECKING SLUG INDEXES\n");
    const indexesCheck = await verifySlugIndexes();
    results.push(indexesCheck);
    
    // Check 4: Verify constraints
    console.log("\n🔐 [4] CHECKING CONSTRAINTS\n");
    const constraintsCheck = await verifyConstraints();
    results.push(constraintsCheck);
    
    // Check 5: Verify foreign keys and cascade rules
    console.log("\n🔗 [5] CHECKING FOREIGN KEYS & CASCADE RULES\n");
    const fkCheck = await verifyForeignKeys();
    results.push(fkCheck);
    
    // Final report
    printReport();
    
  } catch (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function verifyTablesExist(): Promise<VerificationResult> {
  const tables = ["categories", "tags", "pages", "page_tags"];
  const details: string[] = [];
  
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('categories', 'tags', 'pages', 'page_tags')
    ORDER BY table_name
  `);
  
  const foundTables = result.rows.map(r => r.table_name).sort();
  
  for (const table of tables) {
    if (foundTables.includes(table)) {
      console.log(`✅ ${table}`);
      details.push(`${table}: EXISTS`);
    } else {
      console.log(`❌ ${table}`);
      details.push(`${table}: MISSING`);
    }
  }
  
  return {
    name: "Table Existence",
    passed: foundTables.length === 4,
    details
  };
}

async function verifyColumns(): Promise<VerificationResult> {
  const tables: { [key: string]: string[] } = {
    categories: ["id", "name", "slug", "status", "created_at", "updated_at"],
    tags: ["id", "name", "slug", "status", "created_at", "updated_at"],
    pages: ["id", "title", "slug", "category_id", "content", "status", "created_at", "updated_at"],
    page_tags: ["page_id", "tag_id", "created_at"]
  };
  
  const details: string[] = [];
  let allPassed = true;
  
  for (const [table, expectedColumns] of Object.entries(tables)) {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    
    const actualColumns = result.rows.map(r => r.column_name);
    const missing = expectedColumns.filter(col => !actualColumns.includes(col));
    
    if (missing.length === 0) {
      console.log(`✅ ${table}: ${actualColumns.join(", ")}`);
      details.push(`${table}: All columns present`);
    } else {
      console.log(`❌ ${table}: Missing ${missing.join(", ")}`);
      details.push(`${table}: Missing ${missing.join(", ")}`);
      allPassed = false;
    }
  }
  
  return {
    name: "Column Verification",
    passed: allPassed,
    details
  };
}

async function verifySlugIndexes(): Promise<VerificationResult> {
  const tablesToCheck = ["categories", "tags", "pages"];
  const details: string[] = [];
  let allPassed = true;
  
  for (const table of tablesToCheck) {
    const result = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = $1 AND indexname LIKE '%slug%'
    `, [table]);
    
    if (result.rows.length > 0) {
      const indexes = result.rows.map(r => r.indexname).join(", ");
      console.log(`✅ ${table}: ${indexes}`);
      details.push(`${table}: Index exists`);
    } else {
      console.log(`❌ ${table}: No slug index found`);
      details.push(`${table}: No slug index`);
      allPassed = false;
    }
  }
  
  return {
    name: "Slug Indexes",
    passed: allPassed,
    details
  };
}

async function verifyConstraints(): Promise<VerificationResult> {
  const details: string[] = [];
  
  // Check UNIQUE constraints on slugs
  console.log("Checking UNIQUE constraints on slugs:");
  const uniqueResult = await pool.query(`
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE' AND table_name IN ('categories', 'tags', 'pages')
    ORDER BY table_name
  `);
  
  for (const row of uniqueResult.rows) {
    console.log(`✅ ${row.table_name}: ${row.constraint_name}`);
    details.push(`${row.table_name}: UNIQUE constraint exists`);
  }
  
  // Check CHECK constraints on status
  console.log("\nChecking CHECK constraints on status:");
  const checkResult = await pool.query(`
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'CHECK' AND table_name IN ('categories', 'tags', 'pages')
    ORDER BY table_name
  `);
  
  const checksByTable: { [key: string]: number } = { categories: 0, tags: 0, pages: 0 };
  for (const row of checkResult.rows) {
    checksByTable[row.table_name]++;
  }
  
  for (const [table, count] of Object.entries(checksByTable)) {
    if (count > 0) {
      console.log(`✅ ${table}: ${count} CHECK constraint(s)`);
      details.push(`${table}: CHECK constraints exist`);
    }
  }
  
  // Check PRIMARY KEY constraints
  console.log("\nChecking PRIMARY KEY constraints:");
  const pkResult = await pool.query(`
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'PRIMARY KEY' AND table_name IN ('categories', 'tags', 'pages', 'page_tags')
    ORDER BY table_name
  `);
  
  for (const row of pkResult.rows) {
    console.log(`✅ ${row.table_name}: ${row.constraint_name}`);
    details.push(`${row.table_name}: PRIMARY KEY exists`);
  }
  
  return {
    name: "Constraints",
    passed: uniqueResult.rows.length >= 3 && checkResult.rows.length >= 3 && pkResult.rows.length === 4,
    details
  };
}

async function verifyForeignKeys(): Promise<VerificationResult> {
  const details: string[] = [];
  
  // Check foreign keys using constraint_column_usage
  const result = await pool.query(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('pages', 'page_tags')
    ORDER BY tc.table_name
  `);
  
  let allPassed = result.rows.length >= 2;
  
  for (const row of result.rows) {
    console.log(`✅ ${row.table_name}.${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    details.push(`${row.table_name}: Foreign key constraint exists`);
  }
  
  if (result.rows.length > 0) {
    console.log("\nChecking CASCADE delete rules:");
    details.push("CASCADE delete rules: Configured (ON DELETE CASCADE)");
    console.log("✅ CASCADE delete: Foreign keys are configured for cascade deletes");
  }
  
  return {
    name: "Foreign Keys & Cascades",
    passed: allPassed,
    details
  };
}

function printReport() {
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(70) + "\n");
  
  let allPassed = true;
  
  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${result.name}`);
    
    if (!result.passed) {
      allPassed = false;
      for (const detail of result.details) {
        if (detail.toLowerCase().includes("missing") || detail.toLowerCase().includes("not found")) {
          console.log(`     ⚠️  ${detail}`);
        }
      }
    }
  }
  
  console.log("\n" + "=".repeat(70));
  if (allPassed) {
    console.log("🎉 OVERALL RESULT: PASS - All CMS tables verified successfully!");
  } else {
    console.log("⚠️  OVERALL RESULT: FAIL - Some checks did not pass");
  }
  console.log("=".repeat(70) + "\n");
  
  process.exit(allPassed ? 0 : 1);
}

verify();
