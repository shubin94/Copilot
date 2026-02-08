/**
 * PRODUCTION DATABASE SCHEMA VERIFICATION
 * 
 * Comprehensive read-only audit of local database schema
 * to ensure production readiness.
 */

import "../server/lib/loadEnv";
import { db } from "../db/index";
import { sql } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

interface TableInfo {
  tableName: string;
  schemaName: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
}

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  characterMaxLength: number | null;
}

interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

interface IndexInfo {
  indexName: string;
  columnName: string;
  isUnique: boolean;
}

interface ConstraintInfo {
  constraintName: string;
  constraintType: string;
  columnName: string | null;
}

interface Issue {
  severity: "ERROR" | "WARNING" | "INFO";
  category: string;
  table?: string;
  column?: string;
  description: string;
  blocksProduction: boolean;
}

const issues: Issue[] = [];

function addIssue(issue: Issue) {
  issues.push(issue);
  const icon = issue.severity === "ERROR" ? "❌" : issue.severity === "WARNING" ? "⚠️" : "ℹ️";
  const blocker = issue.blocksProduction ? " [BLOCKS PRODUCTION]" : "";
  console.log(`${icon} ${issue.category}: ${issue.description}${blocker}`);
}

// ============================================================================
// STEP 1: INVENTORY CURRENT LOCAL SCHEMA
// ============================================================================

async function getTableInventory(): Promise<Map<string, TableInfo>> {
  console.log("\n" + "=".repeat(80));
  console.log("STEP 1: INVENTORYING LOCAL DATABASE SCHEMA");
  console.log("=".repeat(80));

  const tables = new Map<string, TableInfo>();

  // Get all tables in public, auth, and storage schemas
  const schemasToCheck = ["public", "auth", "storage"];

  for (const schema of schemasToCheck) {
    console.log(`\n📊 Scanning schema: ${schema}`);

    // Get tables in this schema
    const tablesResult = await db.execute<{ tablename: string }>(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = ${schema}
      ORDER BY tablename
    `);

    for (const { tablename } of tablesResult.rows) {
      console.log(`  ├─ Table: ${schema}.${tablename}`);

      // Get columns
      const columnsResult = await db.execute<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        character_maximum_length: number | null;
      }>(sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = ${tablename}
        ORDER BY ordinal_position
      `);

      const columns: ColumnInfo[] = columnsResult.rows.map(col => ({
        columnName: col.column_name,
        dataType: col.data_type,
        isNullable: col.is_nullable === "YES",
        defaultValue: col.column_default,
        characterMaxLength: col.character_maximum_length,
      }));

      // Get primary keys
      const pkResult = await db.execute<{ column_name: string }>(sql`
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = (${schema} || '.' || ${tablename})::regclass
          AND i.indisprimary
      `);

      const primaryKeys = pkResult.rows.map(row => row.column_name);

      // Get foreign keys
      const fkResult = await db.execute<{
        constraint_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
        delete_rule: string;
        update_rule: string;
      }>(sql`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.delete_rule,
          rc.update_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = ${schema}
          AND tc.table_name = ${tablename}
      `);

      const foreignKeys: ForeignKeyInfo[] = fkResult.rows.map(fk => ({
        constraintName: fk.constraint_name,
        columnName: fk.column_name,
        referencedTable: fk.foreign_table_name,
        referencedColumn: fk.foreign_column_name,
        onDelete: fk.delete_rule,
        onUpdate: fk.update_rule,
      }));

      // Get indexes
      const idxResult = await db.execute<{
        indexname: string;
        column_name: string;
        is_unique: boolean;
      }>(sql`
        SELECT
          i.relname AS indexname,
          a.attname AS column_name,
          ix.indisunique AS is_unique
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = ${schema}
          AND t.relname = ${tablename}
          AND t.relkind = 'r'
      `);

      const indexes: IndexInfo[] = idxResult.rows.map(idx => ({
        indexName: idx.indexname,
        columnName: idx.column_name,
        isUnique: idx.is_unique,
      }));

      // Get constraints
      const constraintResult = await db.execute<{
        constraint_name: string;
        constraint_type: string;
        column_name: string | null;
      }>(sql`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = ${schema}
          AND tc.table_name = ${tablename}
      `);

      const constraints: ConstraintInfo[] = constraintResult.rows.map(c => ({
        constraintName: c.constraint_name,
        constraintType: c.constraint_type,
        columnName: c.column_name,
      }));

      tables.set(`${schema}.${tablename}`, {
        tableName: tablename,
        schemaName: schema,
        columns,
        primaryKeys,
        foreignKeys,
        indexes,
        constraints,
      });

      console.log(`     └─ ${columns.length} columns, ${primaryKeys.length} PKs, ${foreignKeys.length} FKs, ${indexes.length} indexes`);
    }
  }

  console.log(`\n✅ Inventoried ${tables.size} tables across ${schemasToCheck.length} schemas`);
  return tables;
}

// ============================================================================
// STEP 2: COMPARE AGAINST APPLICATION USAGE
// ============================================================================

async function scanCodebaseReferences(tables: Map<string, TableInfo>): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("STEP 2: SCANNING CODEBASE FOR TABLE/COLUMN REFERENCES");
  console.log("=".repeat(80));

  // Read schema file
  let schemaPath = path.join(projectRoot, "db", "schema.ts");
  if (!fs.existsSync(schemaPath)) {
    // Try shared/schema.ts
    schemaPath = path.join(projectRoot, "shared", "schema.ts");
    if (!fs.existsSync(schemaPath)) {
      addIssue({
        severity: "ERROR",
        category: "Schema",
        description: "schema.ts not found in db/ or shared/ directory",
        blocksProduction: true,
      });
      return;
    }
  }
  
  console.log(`\n📄 Using schema file: ${path.relative(projectRoot, schemaPath)}`);

  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  // Extract table definitions from schema (simplified - looks for pgTable calls)
  const tableMatches = schemaContent.matchAll(/export const (\w+) = pgTable\("(\w+)"/g);
  const schemaTables = new Set<string>();

  for (const match of tableMatches) {
    const tableName = match[2];
    schemaTables.add(tableName);
    console.log(`  ✓ Schema defines: ${tableName}`);

    // Check if table exists in database
    if (!tables.has(`public.${tableName}`)) {
      addIssue({
        severity: "ERROR",
        category: "Missing Table",
        table: tableName,
        description: `Table ${tableName} is defined in schema but missing in database`,
        blocksProduction: true,
      });
    }
  }

  // Check for tables in DB not in schema (could be Supabase tables, which is OK)
  for (const [fullName, tableInfo] of tables) {
    if (tableInfo.schemaName === "public" && !schemaTables.has(tableInfo.tableName)) {
      // Skip known Supabase internal tables
      if (!tableInfo.tableName.startsWith("_") && tableInfo.tableName !== "schema_migrations") {
        addIssue({
          severity: "WARNING",
          category: "Unmapped Table",
          table: tableInfo.tableName,
          description: `Table ${tableInfo.tableName} exists in database but not in schema.ts`,
          blocksProduction: false,
        });
      }
    }
  }

  console.log(`\n✅ Scanned ${schemaTables.size} schema definitions`);
}

// ============================================================================
// STEP 3: MIGRATION CONSISTENCY CHECK
// ============================================================================

async function checkMigrationConsistency(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("STEP 3: VERIFYING MIGRATION CONSISTENCY");
  console.log("=".repeat(80));

  const migrationsDir = path.join(projectRoot, "supabase", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    addIssue({
      severity: "WARNING",
      category: "Migrations",
      description: "supabase/migrations directory not found",
      blocksProduction: false,
    });
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  console.log(`\n📁 Found ${migrationFiles.length} migration files:`);
  migrationFiles.forEach(f => console.log(`  - ${f}`));

  // Check if migrations have been applied
  try {
    const result = await db.execute<{ version: string }>(sql`
      SELECT version FROM schema_migrations ORDER BY version
    `);
    
    console.log(`\n✅ ${result.rows.length} migrations applied in database`);
    
    if (result.rows.length !== migrationFiles.length) {
      addIssue({
        severity: "WARNING",
        category: "Migrations",
        description: `Migration count mismatch: ${migrationFiles.length} files vs ${result.rows.length} applied`,
        blocksProduction: false,
      });
    }
  } catch (error) {
    console.log(`\nℹ️  schema_migrations table not found (using alternative tracking)`);
  }
}

// ============================================================================
// STEP 4: SUPABASE-SPECIFIC CHECKS
// ============================================================================

async function checkSupabaseRequirements(tables: Map<string, TableInfo>): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("STEP 4: CHECKING SUPABASE-SPECIFIC REQUIREMENTS");
  console.log("=".repeat(80));

  // Required schemas
  const requiredSchemas = ["auth", "storage", "public"];
  const existingSchemas = new Set([...tables.values()].map(t => t.schemaName));

  for (const schema of requiredSchemas) {
    if (existingSchemas.has(schema)) {
      console.log(`  ✓ Schema exists: ${schema}`);
    } else {
      addIssue({
        severity: "ERROR",
        category: "Missing Schema",
        description: `Required Supabase schema missing: ${schema}`,
        blocksProduction: true,
      });
    }
  }

  // Check for Supabase extensions
  const extensionsResult = await db.execute<{ extname: string }>(sql`
    SELECT extname FROM pg_extension
  `);

  const extensions = extensionsResult.rows.map(r => r.extname);
  console.log(`\n📦 Installed extensions: ${extensions.join(", ")}`);

  // Common required extensions
  const recommendedExtensions = ["uuid-ossp", "pgcrypto"];
  for (const ext of recommendedExtensions) {
    if (!extensions.includes(ext)) {
      addIssue({
        severity: "WARNING",
        category: "Extensions",
        description: `Recommended extension missing: ${ext}`,
        blocksProduction: false,
      });
    }
  }
}

// ============================================================================
// STEP 5: PRODUCTION READINESS CHECKS
// ============================================================================

async function checkProductionReadiness(tables: Map<string, TableInfo>): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("STEP 5: PRODUCTION READINESS CHECKS");
  console.log("=".repeat(80));

  for (const [fullName, table] of tables) {
    if (table.schemaName !== "public") continue; // Focus on public schema

    console.log(`\n🔍 Checking: ${fullName}`);

    // Check for primary keys
    if (table.primaryKeys.length === 0) {
      addIssue({
        severity: "WARNING",
        category: "Primary Key",
        table: table.tableName,
        description: `Table ${table.tableName} has no primary key`,
        blocksProduction: false,
      });
    }

    // Check timestamp columns have defaults
    for (const col of table.columns) {
      if ((col.columnName === "created_at" || col.columnName === "updated_at") &&
          !col.defaultValue) {
        addIssue({
          severity: "WARNING",
          category: "Default Value",
          table: table.tableName,
          column: col.columnName,
          description: `Timestamp column ${table.tableName}.${col.columnName} missing default value`,
          blocksProduction: false,
        });
      }

      // Check for text columns without length limit (potential issue)
      if (col.dataType === "text" && !col.characterMaxLength && 
          !col.columnName.includes("description") && 
          !col.columnName.includes("content") &&
          !col.columnName.includes("body")) {
        addIssue({
          severity: "INFO",
          category: "Data Type",
          table: table.tableName,
          column: col.columnName,
          description: `Column ${table.tableName}.${col.columnName} is unlimited TEXT (consider varchar with limit)`,
          blocksProduction: false,
        });
      }
    }

    // Check foreign key cascade rules
    for (const fk of table.foreignKeys) {
      if (fk.onDelete === "NO ACTION") {
        addIssue({
          severity: "INFO",
          category: "Cascade Rule",
          table: table.tableName,
          column: fk.columnName,
          description: `FK ${table.tableName}.${fk.columnName} has NO ACTION on delete (consider CASCADE or SET NULL)`,
          blocksProduction: false,
        });
      }
    }

    // Check for indexes on foreign keys
    const fkColumns = new Set(table.foreignKeys.map(fk => fk.columnName));
    const indexedColumns = new Set(table.indexes.map(idx => idx.columnName));
    
    for (const fkCol of fkColumns) {
      if (!indexedColumns.has(fkCol)) {
        addIssue({
          severity: "WARNING",
          category: "Missing Index",
          table: table.tableName,
          column: fkCol,
          description: `Foreign key column ${table.tableName}.${fkCol} has no index (performance issue)`,
          blocksProduction: false,
        });
      }
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log("\n" + "█".repeat(80));
  console.log("█" + " ".repeat(78) + "█");
  console.log("█" + "  PRODUCTION DATABASE SCHEMA VERIFICATION".padEnd(78) + "█");
  console.log("█" + "  Read-only audit of local database schema".padEnd(78) + "█");
  console.log("█" + " ".repeat(78) + "█");
  console.log("█".repeat(80));

  try {
    // Step 1: Inventory
    const tables = await getTableInventory();

    // Step 2: Codebase scan
    await scanCodebaseReferences(tables);

    // Step 3: Migrations
    await checkMigrationConsistency();

    // Step 4: Supabase checks
    await checkSupabaseRequirements(tables);

    // Step 5: Production readiness
    await checkProductionReadiness(tables);

    // Final report
    console.log("\n" + "█".repeat(80));
    console.log("█" + " ".repeat(78) + "█");
    console.log("█" + "  FINAL AUDIT REPORT".padEnd(78) + "█");
    console.log("█" + " ".repeat(78) + "█");
    console.log("█".repeat(80));

    const errors = issues.filter(i => i.severity === "ERROR");
    const warnings = issues.filter(i => i.severity === "WARNING");
    const infos = issues.filter(i => i.severity === "INFO");
    const blockers = issues.filter(i => i.blocksProduction);

    console.log(`\n📊 Summary:`);
    console.log(`   Total tables: ${tables.size}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    console.log(`   Info: ${infos.length}`);
    console.log(`   Production blockers: ${blockers.length}`);

    if (blockers.length > 0) {
      console.log("\n❌ PRODUCTION BLOCKERS FOUND:");
      blockers.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.severity}] ${issue.category}`);
        if (issue.table) console.log(`   Table: ${issue.table}`);
        if (issue.column) console.log(`   Column: ${issue.column}`);
        console.log(`   Issue: ${issue.description}`);
      });
    }

    // Final verdict
    console.log("\n" + "=".repeat(80));
    if (blockers.length > 0) {
      console.log("🛑 VERDICT: DO NOT PUSH TO PRODUCTION");
      console.log("   Fix the blockers above before deploying.");
      process.exit(1);
    } else if (errors.length > 0) {
      console.log("⚠️  VERDICT: CAUTION - REVIEW REQUIRED");
      console.log("   Non-blocking errors found. Review before deploying.");
      process.exit(0);
    } else if (warnings.length > 5) {
      console.log("⚠️  VERDICT: SAFE TO PUSH (with warnings)");
      console.log("   Multiple warnings found. Consider fixing for optimal performance.");
      process.exit(0);
    } else {
      console.log("✅ VERDICT: SAFE TO PUSH TO PRODUCTION");
      console.log("   Schema is production-ready!");
      process.exit(0);
    }

  } catch (error) {
    console.error("\n❌ FATAL ERROR during schema verification:");
    console.error(error);
    process.exit(1);
  }
}

main();
