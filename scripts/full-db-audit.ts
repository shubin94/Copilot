/**
 * Full Database Audit Script - READ ONLY
 * 
 * Performs comprehensive structural analysis of PostgreSQL database
 * NO MODIFICATIONS - INSPECTION ONLY
 * 
 * Usage: npx tsx scripts/full-db-audit.ts
 */

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface TableInfo {
  tableName: string;
  rowCount: number;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
  defaultValue: string | null;
}

interface ForeignKeyInfo {
  column: string;
  refTable: string;
  refColumn: string;
  onDelete: string;
  onUpdate: string;
}

interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

const auditData = {
  tables: [] as TableInfo[],
  issues: {
    missingPKs: [] as string[],
    idTypeMismatches: [] as any[],
    missingFKs: [] as any[],
    slugBasedRels: [] as any[],
    unindexedFKs: [] as any[],
    performanceRisks: [] as any[],
    seoIntegrityIssues: [] as any[],
  },
};

// ============================================================================
// A) INVENTORY - Get all tables and row counts
// ============================================================================
async function getTableInventory(): Promise<string[]> {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map(r => r.table_name);
}

async function getRowCount(tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count);
  } catch {
    return 0;
  }
}

// ============================================================================
// B) SCHEMA ANALYSIS - Columns, types, constraints
// ============================================================================
async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  const result = await pool.query(`
    SELECT 
      column_name as name,
      data_type as type,
      is_nullable as nullable,
      column_default as "defaultValue"
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows;
}

async function getPrimaryKeys(tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
      AND i.indisprimary
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function getIndexes(tableName: string): Promise<IndexInfo[]> {
  const result = await pool.query(`
    SELECT
      i.relname as index_name,
      array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
      ix.indisunique as is_unique,
      ix.indisprimary as is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = $1
      AND t.relkind = 'r'
    GROUP BY i.relname, ix.indisunique, ix.indisprimary
    ORDER BY i.relname
  `, [tableName]);
  
  return result.rows.map(r => ({
    name: r.index_name,
    columns: r.columns,
    isUnique: r.is_unique,
    isPrimary: r.is_primary,
  }));
}

// ============================================================================
// C) FOREIGN KEYS - Relationships and cascade rules
// ============================================================================
async function getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
  const result = await pool.query(`
    SELECT
      kcu.column_name as column,
      ccu.table_name as ref_table,
      ccu.column_name as ref_column,
      rc.delete_rule as on_delete,
      rc.update_rule as on_update
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
  `, [tableName]);
  
  return result.rows.map(r => ({
    column: r.column,
    refTable: r.ref_table,
    refColumn: r.ref_column,
    onDelete: r.on_delete,
    onUpdate: r.on_update,
  }));
}

// ============================================================================
// D) ID TYPE CONSISTENCY - Check all ID columns
// ============================================================================
async function analyzeIdTypes() {
  const idColumns: any[] = [];
  
  for (const table of auditData.tables) {
    for (const col of table.columns) {
      if (col.name === 'id' || col.name.endsWith('_id')) {
        idColumns.push({
          table: table.tableName,
          column: col.name,
          type: col.type,
        });
      }
    }
  }
  
  // Group by column name and check for type inconsistencies
  const byColumnName = new Map<string, Set<string>>();
  for (const col of idColumns) {
    if (!byColumnName.has(col.column)) {
      byColumnName.set(col.column, new Set());
    }
    byColumnName.get(col.column)!.add(col.type);
  }
  
  for (const [colName, types] of byColumnName) {
    if (types.size > 1) {
      const tables = idColumns.filter(c => c.column === colName);
      auditData.issues.idTypeMismatches.push({
        column: colName,
        types: Array.from(types),
        occurrences: tables,
      });
    }
  }
  
  return idColumns;
}

// ============================================================================
// E) RELATIONSHIP INTEGRITY - Detect slug/code-based joins
// ============================================================================
async function analyzeRelationshipIntegrity() {
  // Check for columns that look like they should be FKs but aren't
  const suspectColumns = [
    { table: 'detectives', column: 'country', shouldReference: 'countries' },
    { table: 'detectives', column: 'state', shouldReference: 'states' },
    { table: 'detectives', column: 'city', shouldReference: 'cities' },
    { table: 'services', column: 'category_slug', shouldReference: 'service_categories' },
    { table: 'location_seo_overrides', column: 'entity_id', shouldReference: 'multiple' },
  ];
  
  for (const suspect of suspectColumns) {
    const table = auditData.tables.find(t => t.tableName === suspect.table);
    if (!table) continue;
    
    const column = table.columns.find(c => c.name === suspect.column);
    if (!column) continue;
    
    const hasForeignKey = table.foreignKeys.some(fk => fk.column === suspect.column);
    
    if (!hasForeignKey) {
      if (column.type === 'text' || column.type.includes('character')) {
        auditData.issues.slugBasedRels.push({
          table: suspect.table,
          column: suspect.column,
          type: column.type,
          shouldReference: suspect.shouldReference,
          issue: 'Text-based relationship without FK constraint',
        });
      }
    }
  }
  
  // Check for missing FK constraints between related tables
  const expectedFKs = [
    { from: 'states', column: 'country_id', to: 'countries' },
    { from: 'cities', column: 'state_id', to: 'states' },
    { from: 'services', column: 'detective_id', to: 'detectives' },
    { from: 'reviews', column: 'detective_id', to: 'detectives' },
    { from: 'reviews', column: 'user_id', to: 'users' },
  ];
  
  for (const expected of expectedFKs) {
    const table = auditData.tables.find(t => t.tableName === expected.from);
    if (!table) continue;
    
    const hasForeignKey = table.foreignKeys.some(
      fk => fk.column === expected.column && fk.refTable === expected.to
    );
    
    if (!hasForeignKey) {
      auditData.issues.missingFKs.push({
        from: `${expected.from}.${expected.column}`,
        to: expected.to,
        issue: 'Expected FK constraint not found',
      });
    }
  }
}

// ============================================================================
// F) PERFORMANCE RISKS - Unindexed columns and large tables
// ============================================================================
async function analyzePerformanceRisks() {
  for (const table of auditData.tables) {
    // Check for FKs without indexes
    for (const fk of table.foreignKeys) {
      const hasIndex = table.indexes.some(idx => {
        const cols = Array.isArray(idx.columns) ? idx.columns : [idx.columns];
        return cols.includes(fk.column) || idx.isPrimary;
      });
      
      if (!hasIndex) {
        auditData.issues.unindexedFKs.push({
          table: table.tableName,
          column: fk.column,
          references: `${fk.refTable}.${fk.refColumn}`,
        });
      }
    }
    
    // Check large tables without proper indexes
    if (table.rowCount > 10000) {
      const nonPKIndexes = table.indexes.filter(idx => !idx.isPrimary);
      if (nonPKIndexes.length === 0) {
        auditData.issues.performanceRisks.push({
          table: table.tableName,
          rowCount: table.rowCount,
          issue: 'Large table with no indexes (excluding PK)',
          severity: 'HIGH',
        });
      }
    }
    
    // Check for commonly queried columns without indexes
    const queryColumns = ['slug', 'code', 'email', 'status'];
    for (const colName of queryColumns) {
      const column = table.columns.find(c => c.name === colName);
      if (!column) continue;
      
      const hasIndex = table.indexes.some(idx => {
        const cols = Array.isArray(idx.columns) ? idx.columns : [idx.columns];
        return cols.includes(colName);
      });
      if (!hasIndex && table.rowCount > 1000) {
        auditData.issues.performanceRisks.push({
          table: table.tableName,
          column: colName,
          rowCount: table.rowCount,
          issue: 'Frequently queried column without index',
          severity: table.rowCount > 10000 ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  }
}

// ============================================================================
// G) SEO OVERRIDE INTEGRITY - Analyze location_seo_overrides
// ============================================================================
async function analyzeSeoOverrideIntegrity() {
  const lsoTable = auditData.tables.find(t => t.tableName === 'location_seo_overrides');
  if (!lsoTable) {
    auditData.issues.seoIntegrityIssues.push({
      issue: 'location_seo_overrides table not found',
      severity: 'CRITICAL',
    });
    return;
  }
  
  // Check entity_id type
  const entityIdCol = lsoTable.columns.find(c => c.name === 'entity_id');
  if (entityIdCol) {
    auditData.issues.seoIntegrityIssues.push({
      column: 'entity_id',
      type: entityIdCol.type,
      analysis: 'Using text-based entity_id without FK constraints',
      risk: 'Can insert overrides for non-existent locations',
    });
  }
  
  // Check for unique constraint on (entity_type, entity_id)
  const hasUniqueConstraint = lsoTable.indexes.some(idx => {
    const cols = Array.isArray(idx.columns) ? idx.columns : [idx.columns];
    return idx.isUnique && 
      cols.includes('entity_type') && 
      cols.includes('entity_id');
  });
  
  if (!hasUniqueConstraint) {
    auditData.issues.seoIntegrityIssues.push({
      issue: 'Missing unique constraint on (entity_type, entity_id)',
      risk: 'Multiple overrides can exist for same location',
      severity: 'HIGH',
    });
  }
  
  // Check if entity_id type matches referenced tables
  const entityTypeCol = lsoTable.columns.find(c => c.name === 'entity_type');
  if (entityIdCol && entityTypeCol) {
    const countriesTable = auditData.tables.find(t => t.tableName === 'countries');
    const statesTable = auditData.tables.find(t => t.tableName === 'states');
    const citiesTable = auditData.tables.find(t => t.tableName === 'cities');
    
    const referencedIdTypes = [];
    if (countriesTable) {
      const slugCol = countriesTable.columns.find(c => c.name === 'slug');
      if (slugCol) referencedIdTypes.push({ table: 'countries.slug', type: slugCol.type });
    }
    if (statesTable) {
      const slugCol = statesTable.columns.find(c => c.name === 'slug');
      if (slugCol) referencedIdTypes.push({ table: 'states.slug', type: slugCol.type });
    }
    if (citiesTable) {
      const slugCol = citiesTable.columns.find(c => c.name === 'slug');
      if (slugCol) referencedIdTypes.push({ table: 'cities.slug', type: slugCol.type });
    }
    
    auditData.issues.seoIntegrityIssues.push({
      info: 'entity_id references slugs via concatenation',
      entityIdType: entityIdCol.type,
      referencedTypes: referencedIdTypes,
      pattern: 'country_slug or country_slug/state_slug or country_slug/state_slug/city_slug',
    });
  }
}

// ============================================================================
// MAIN AUDIT FUNCTION
// ============================================================================
async function runAudit() {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE STRUCTURAL AUDIT - READ ONLY');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Database: ${process.env.DATABASE_URL ? '✓ Connected' : '✗ No DATABASE_URL'}`);
  console.log('='.repeat(80) + '\n');
  
  try {
    // A) INVENTORY
    console.log('📦 A) TABLE INVENTORY');
    console.log('-'.repeat(80));
    const tableNames = await getTableInventory();
    console.log(`Found ${tableNames.length} tables in public schema\n`);
    
    for (const tableName of tableNames) {
      const rowCount = await getRowCount(tableName);
      const columns = await getTableColumns(tableName);
      const primaryKeys = await getPrimaryKeys(tableName);
      const foreignKeys = await getForeignKeys(tableName);
      const indexes = await getIndexes(tableName);
      
      auditData.tables.push({
        tableName,
        rowCount,
        columns,
        primaryKeys,
        foreignKeys,
        indexes,
      });
      
      console.log(`  ${tableName.padEnd(40)} ${String(rowCount).padStart(8)} rows`);
      
      if (primaryKeys.length === 0) {
        auditData.issues.missingPKs.push(tableName);
      }
    }
    
    // B) SCHEMA ANALYSIS
    console.log('\n📋 B) SCHEMA ANALYSIS');
    console.log('-'.repeat(80));
    for (const table of auditData.tables) {
      console.log(`\n  Table: ${table.tableName} (${table.rowCount} rows)`);
      console.log(`  Primary Key: ${table.primaryKeys.join(', ') || 'NONE'}`);
      console.log(`  Columns:`);
      for (const col of table.columns) {
        const nullInfo = col.nullable === 'NO' ? 'NOT NULL' : 'NULL';
        const defaultInfo = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
        console.log(`    - ${col.name.padEnd(30)} ${col.type.padEnd(20)} ${nullInfo}${defaultInfo}`);
      }
      if (table.indexes.length > 0) {
        console.log(`  Indexes:`);
        for (const idx of table.indexes) {
          const type = idx.isPrimary ? 'PRIMARY' : idx.isUnique ? 'UNIQUE' : 'INDEX';
          const cols = Array.isArray(idx.columns) ? idx.columns.join(', ') : String(idx.columns);
          console.log(`    - ${idx.name}: [${cols}] (${type})`);
        }
      }
    }
    
    // C) FOREIGN KEYS
    console.log('\n🔗 C) FOREIGN KEY RELATIONSHIPS');
    console.log('-'.repeat(80));
    for (const table of auditData.tables) {
      if (table.foreignKeys.length > 0) {
        console.log(`\n  ${table.tableName}:`);
        for (const fk of table.foreignKeys) {
          console.log(`    ${fk.column} → ${fk.refTable}.${fk.refColumn}`);
          console.log(`      ON DELETE ${fk.onDelete} | ON UPDATE ${fk.onUpdate}`);
        }
      }
    }
    
    // D) ID TYPE CONSISTENCY
    console.log('\n🔢 D) ID TYPE CONSISTENCY');
    console.log('-'.repeat(80));
    const idColumns = await analyzeIdTypes();
    
    const idTypeGroups = new Map<string, any[]>();
    for (const col of idColumns) {
      if (!idTypeGroups.has(col.type)) {
        idTypeGroups.set(col.type, []);
      }
      idTypeGroups.get(col.type)!.push(`${col.table}.${col.column}`);
    }
    
    for (const [type, columns] of idTypeGroups) {
      console.log(`\n  Type: ${type}`);
      columns.forEach(c => console.log(`    - ${c}`));
    }
    
    if (auditData.issues.idTypeMismatches.length > 0) {
      console.log('\n  ⚠️  TYPE MISMATCHES DETECTED:');
      for (const mismatch of auditData.issues.idTypeMismatches) {
        console.log(`    Column: ${mismatch.column}`);
        console.log(`    Types found: ${mismatch.types.join(', ')}`);
        mismatch.occurrences.forEach((o: any) => {
          console.log(`      - ${o.table}.${o.column}: ${o.type}`);
        });
      }
    }
    
    // E) RELATIONSHIP INTEGRITY
    console.log('\n🔍 E) RELATIONSHIP INTEGRITY');
    console.log('-'.repeat(80));
    await analyzeRelationshipIntegrity();
    
    if (auditData.issues.slugBasedRels.length > 0) {
      console.log('\n  ⚠️  SLUG/CODE-BASED RELATIONSHIPS (NO FK):');
      for (const rel of auditData.issues.slugBasedRels) {
        console.log(`    ${rel.table}.${rel.column} (${rel.type})`);
        console.log(`      Should reference: ${rel.shouldReference}`);
        console.log(`      Issue: ${rel.issue}`);
      }
    }
    
    if (auditData.issues.missingFKs.length > 0) {
      console.log('\n  ⚠️  MISSING FK CONSTRAINTS:');
      for (const fk of auditData.issues.missingFKs) {
        console.log(`    ${fk.from} → ${fk.to}`);
        console.log(`      ${fk.issue}`);
      }
    }
    
    // F) PERFORMANCE RISKS
    console.log('\n⚡ F) PERFORMANCE RISKS');
    console.log('-'.repeat(80));
    await analyzePerformanceRisks();
    
    if (auditData.issues.unindexedFKs.length > 0) {
      console.log('\n  ⚠️  FOREIGN KEYS WITHOUT INDEXES:');
      for (const fk of auditData.issues.unindexedFKs) {
        console.log(`    ${fk.table}.${fk.column} → ${fk.references}`);
      }
    }
    
    if (auditData.issues.performanceRisks.length > 0) {
      const high = auditData.issues.performanceRisks.filter(r => r.severity === 'HIGH');
      const medium = auditData.issues.performanceRisks.filter(r => r.severity === 'MEDIUM');
      
      if (high.length > 0) {
        console.log('\n  🔴 HIGH SEVERITY:');
        for (const risk of high) {
          console.log(`    ${risk.table}${risk.column ? `.${risk.column}` : ''} (${risk.rowCount} rows)`);
          console.log(`      ${risk.issue}`);
        }
      }
      
      if (medium.length > 0) {
        console.log('\n  🟡 MEDIUM SEVERITY:');
        for (const risk of medium) {
          console.log(`    ${risk.table}${risk.column ? `.${risk.column}` : ''} (${risk.rowCount} rows)`);
          console.log(`      ${risk.issue}`);
        }
      }
    }
    
    // G) SEO OVERRIDE INTEGRITY
    console.log('\n🌐 G) SEO OVERRIDE INTEGRITY');
    console.log('-'.repeat(80));
    await analyzeSeoOverrideIntegrity();
    
    if (auditData.issues.seoIntegrityIssues.length > 0) {
      for (const issue of auditData.issues.seoIntegrityIssues) {
        if (issue.severity) {
          console.log(`  [${issue.severity}] ${issue.issue || issue.info}`);
        } else if (issue.column) {
          console.log(`  Column: ${issue.column} (${issue.type})`);
          console.log(`    ${issue.analysis}`);
          console.log(`    Risk: ${issue.risk}`);
        } else if (issue.info) {
          console.log(`  ${issue.info}`);
          console.log(`    entity_id type: ${issue.entityIdType}`);
          console.log(`    Pattern: ${issue.pattern}`);
          if (issue.referencedTypes && issue.referencedTypes.length > 0) {
            console.log(`    Referenced types:`);
            issue.referencedTypes.forEach((t: any) => {
              console.log(`      - ${t.table}: ${t.type}`);
            });
          }
        } else {
          console.log(`  ${issue.issue}`);
          console.log(`    Risk: ${issue.risk}`);
          console.log(`    Severity: ${issue.severity}`);
        }
      }
    }
    
    // H) SUMMARY
    console.log('\n📊 H) SUMMARY & SCORING');
    console.log('='.repeat(80));
    
    const totalTables = auditData.tables.length;
    const tablesWithPK = totalTables - auditData.issues.missingPKs.length;
    const totalFKs = auditData.tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);
    const indexedFKs = totalFKs - auditData.issues.unindexedFKs.length;
    
    const pkScore = (tablesWithPK / totalTables) * 100;
    const fkIndexScore = totalFKs > 0 ? (indexedFKs / totalFKs) * 100 : 100;
    const relationshipScore = Math.max(0, 100 - (auditData.issues.missingFKs.length * 10));
    const performanceScore = Math.max(0, 100 - (auditData.issues.performanceRisks.length * 5));
    
    console.log('\n  Metrics:');
    console.log(`    Total Tables:              ${totalTables}`);
    console.log(`    Tables with Primary Key:   ${tablesWithPK}/${totalTables}`);
    console.log(`    Total Foreign Keys:        ${totalFKs}`);
    console.log(`    FK with Indexes:           ${indexedFKs}/${totalFKs}`);
    console.log(`    Slug-based Relationships:  ${auditData.issues.slugBasedRels.length}`);
    console.log(`    Missing FK Constraints:    ${auditData.issues.missingFKs.length}`);
    
    console.log('\n  Scores:');
    console.log(`    Primary Key Coverage:      ${pkScore.toFixed(1)}%`);
    console.log(`    FK Index Coverage:         ${fkIndexScore.toFixed(1)}%`);
    console.log(`    Relationship Integrity:    ${relationshipScore.toFixed(1)}%`);
    console.log(`    Performance Readiness:     ${performanceScore.toFixed(1)}%`);
    
    const overallScore = (pkScore + fkIndexScore + relationshipScore + performanceScore) / 4;
    console.log(`\n  ⭐ STRUCTURAL INTEGRITY:    ${overallScore.toFixed(1)}/100`);
    
    // RISK ASSESSMENT
    console.log('\n🎯 RISK ASSESSMENT');
    console.log('-'.repeat(80));
    
    console.log('\n  🔴 HIGH RISK (Immediate Action Required):');
    let highRiskCount = 0;
    
    if (auditData.issues.slugBasedRels.length > 0) {
      highRiskCount++;
      console.log(`    ${highRiskCount}. Text-based relationships without FK constraints`);
      console.log(`       Affected: detectives.country/state/city`);
      console.log(`       Impact: Data inconsistency, orphaned records, poor query performance`);
    }
    
    const highPerfRisks = auditData.issues.performanceRisks.filter(r => r.severity === 'HIGH');
    if (highPerfRisks.length > 0) {
      highRiskCount++;
      console.log(`    ${highRiskCount}. Large tables without proper indexes (${highPerfRisks.length} instances)`);
      console.log(`       Impact: Slow queries, database locks, poor scalability`);
    }
    
    const criticalSEO = auditData.issues.seoIntegrityIssues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH');
    if (criticalSEO.length > 0) {
      highRiskCount++;
      console.log(`    ${highRiskCount}. SEO override integrity issues (${criticalSEO.length} instances)`);
      console.log(`       Impact: Overrides for non-existent locations, duplicate overrides`);
    }
    
    if (highRiskCount === 0) {
      console.log(`    ✓ No high-risk issues detected`);
    }
    
    console.log('\n  🟡 MEDIUM RISK (Address within 1 month):');
    let mediumRiskCount = 0;
    
    if (auditData.issues.unindexedFKs.length > 0) {
      mediumRiskCount++;
      console.log(`    ${mediumRiskCount}. Foreign keys without indexes (${auditData.issues.unindexedFKs.length} instances)`);
      console.log(`       Impact: Slower JOIN operations, cascading delete performance`);
    }
    
    if (auditData.issues.idTypeMismatches.length > 0) {
      mediumRiskCount++;
      console.log(`    ${mediumRiskCount}. Inconsistent ID types across tables`);
      console.log(`       Impact: JOIN complexity, potential migration issues`);
    }
    
    const mediumPerfRisks = auditData.issues.performanceRisks.filter(r => r.severity === 'MEDIUM');
    if (mediumPerfRisks.length > 0) {
      mediumRiskCount++;
      console.log(`    ${mediumRiskCount}. Unindexed query columns (${mediumPerfRisks.length} instances)`);
      console.log(`       Impact: Degraded query performance as data grows`);
    }
    
    if (mediumRiskCount === 0) {
      console.log(`    ✓ No medium-risk issues detected`);
    }
    
    console.log('\n  🟢 LONG-TERM REFACTORING (3+ months):');
    console.log(`    1. Full normalization of location hierarchy`);
    console.log(`       - Migrate detectives.country/state/city to FK-based relationships`);
    console.log(`       - Implement proper cascade rules`);
    console.log(`    2. Standardize ID types across all tables`);
    console.log(`       - Choose uuid vs varchar vs integer`);
    console.log(`    3. Comprehensive indexing strategy`);
    console.log(`       - Add composite indexes for common query patterns`);
    console.log(`    4. SEO override system refactor`);
    console.log(`       - Replace entity_id with proper FK relationships`);
    console.log(`       - Add database-level constraints`);
    
    console.log('\n' + '='.repeat(80));
    console.log('END OF AUDIT - NO MODIFICATIONS MADE');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ AUDIT FAILED:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the audit
runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
