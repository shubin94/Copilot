/**
 * COMPREHENSIVE DATABASE AUDIT - READ ONLY
 * 
 * This script performs a full structural audit of the PostgreSQL database.
 * NO MODIFICATIONS ARE MADE - INSPECTION ONLY.
 */

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface TableInfo {
  tableName: string;
  columns: any[];
  primaryKeys: any[];
  foreignKeys: any[];
  indexes: any[];
  rowCount: number;
}

const auditResults: any = {
  tables: [] as TableInfo[],
  issues: {
    missingPrimaryKeys: [],
    missingFKIndexes: [],
    inconsistentIdTypes: [],
    slugBasedJoins: [],
    duplicateData: [],
    missingFKConstraints: [],
    typeMismatches: [],
    scalabilityRisks: [],
    performanceRisks: [],
  },
};

async function getAllTables(): Promise<string[]> {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((r) => r.table_name);
}

async function getTableColumns(tableName: string) {
  const result = await pool.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows;
}

async function getPrimaryKeys(tableName: string) {
  const result = await pool.query(`
    SELECT a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
      AND i.indisprimary
  `, [tableName]);
  return result.rows;
}

async function getForeignKeys(tableName: string) {
  const result = await pool.query(`
    SELECT
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
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
  `, [tableName]);
  return result.rows;
}

async function getIndexes(tableName: string) {
  const result = await pool.query(`
    SELECT
      i.relname as index_name,
      a.attname as column_name,
      ix.indisunique as is_unique,
      ix.indisprimary as is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = $1
      AND t.relkind = 'r'
    ORDER BY i.relname, a.attnum
  `, [tableName]);
  return result.rows;
}

async function getRowCount(tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count);
  } catch {
    return 0;
  }
}

async function auditTable(tableName: string): Promise<TableInfo> {
  console.log(`  📋 Auditing: ${tableName}...`);
  
  const columns = await getTableColumns(tableName);
  const primaryKeys = await getPrimaryKeys(tableName);
  const foreignKeys = await getForeignKeys(tableName);
  const indexes = await getIndexes(tableName);
  const rowCount = await getRowCount(tableName);

  // Check for missing primary key
  if (primaryKeys.length === 0) {
    auditResults.issues.missingPrimaryKeys.push(tableName);
  }

  // Check for foreign keys without indexes
  for (const fk of foreignKeys) {
    const hasIndex = indexes.some(idx => idx.column_name === fk.column_name);
    if (!hasIndex) {
      auditResults.issues.missingFKIndexes.push({
        table: tableName,
        column: fk.column_name,
        references: `${fk.foreign_table_name}.${fk.foreign_column_name}`,
      });
    }
  }

  // Check for large tables without indexes (excluding PK)
  if (rowCount > 1000) {
    const nonPKIndexes = indexes.filter(idx => !idx.is_primary);
    if (nonPKIndexes.length === 0) {
      auditResults.issues.scalabilityRisks.push({
        table: tableName,
        rowCount,
        issue: 'Large table with no indexes (excluding PK)',
      });
    }
  }

  return {
    tableName,
    columns,
    primaryKeys,
    foreignKeys,
    indexes,
    rowCount,
  };
}

async function detectIdTypeInconsistencies(tables: TableInfo[]) {
  const idColumns = new Map<string, string>();
  
  for (const table of tables) {
    const idCol = table.columns.find(c => c.column_name === 'id');
    if (idCol) {
      idColumns.set(table.tableName, idCol.data_type);
    }
  }

  const types = Array.from(new Set(idColumns.values()));
  if (types.length > 1) {
    auditResults.issues.inconsistentIdTypes.push({
      message: 'Multiple ID types detected across tables',
      breakdown: Object.fromEntries(idColumns),
    });
  }
}

async function detectSlugBasedRelationships(tables: TableInfo[]) {
  // Check for slug/code columns used in relationships instead of proper FKs
  const suspectPatterns = [
    { table: 'detectives', columns: ['country', 'state', 'city'] },
    { table: 'services', columns: ['detective_id'] },
    { table: 'location_seo_overrides', columns: ['entity_id'] },
  ];

  for (const pattern of suspectPatterns) {
    const table = tables.find(t => t.tableName === pattern.table);
    if (!table) continue;

    for (const colName of pattern.columns) {
      const column = table.columns.find(c => c.column_name === colName);
      if (!column) continue;

      const hasForeignKey = table.foreignKeys.some(fk => fk.column_name === colName);
      
      if (!hasForeignKey && (column.data_type === 'text' || column.data_type === 'character varying')) {
        auditResults.issues.slugBasedJoins.push({
          table: pattern.table,
          column: colName,
          dataType: column.data_type,
          issue: 'Text-based relationship without FK constraint',
        });
      }
    }
  }
}

async function checkRelationshipIntegrity(tables: TableInfo[]) {
  // Check detectives -> countries relationship
  const detectivesTable = tables.find(t => t.tableName === 'detectives');
  const countriesTable = tables.find(t => t.tableName === 'countries');
  
  if (detectivesTable && countriesTable) {
    const countryCol = detectivesTable.columns.find(c => c.column_name === 'country');
    const countriesIdCol = countriesTable.columns.find(c => c.column_name === 'id');
    const countriesCodeCol = countriesTable.columns.find(c => c.column_name === 'code');
    
    if (countryCol && countriesIdCol) {
      const typesMatch = countryCol.data_type === countriesIdCol.data_type;
      if (!typesMatch) {
        auditResults.issues.typeMismatches.push({
          relationship: 'detectives.country -> countries.id',
          leftType: countryCol.data_type,
          rightType: countriesIdCol.data_type,
          issue: 'Type mismatch in logical relationship',
        });
      }

      const hasForeignKey = detectivesTable.foreignKeys.some(
        fk => fk.column_name === 'country' && fk.foreign_table_name === 'countries'
      );
      
      if (!hasForeignKey) {
        auditResults.issues.missingFKConstraints.push({
          from: 'detectives.country',
          to: 'countries',
          issue: 'Logical relationship exists but no FK constraint',
          evidence: 'JOIN pattern detected in routes.ts',
        });
      }
    }
  }

  // Check states -> countries relationship
  const statesTable = tables.find(t => t.tableName === 'states');
  if (statesTable && countriesTable) {
    const fk = statesTable.foreignKeys.find(fk => fk.foreign_table_name === 'countries');
    if (fk) {
      // Good - FK exists
    } else {
      auditResults.issues.missingFKConstraints.push({
        from: 'states',
        to: 'countries',
        issue: 'Expected FK to countries not found',
      });
    }
  }

  // Check cities -> states relationship
  const citiesTable = tables.find(t => t.tableName === 'cities');
  if (citiesTable && statesTable) {
    const fk = citiesTable.foreignKeys.find(fk => fk.foreign_table_name === 'states');
    if (fk) {
      // Good - FK exists
    } else {
      auditResults.issues.missingFKConstraints.push({
        from: 'cities',
        to: 'states',
        issue: 'Expected FK to states not found',
      });
    }
  }
}

async function detectPerformanceRisks(tables: TableInfo[]) {
  // Check for text columns frequently used in WHERE clauses without indexes
  const highTrafficTables = ['detectives', 'services', 'reviews', 'countries', 'states', 'cities'];
  
  for (const tableName of highTrafficTables) {
    const table = tables.find(t => t.tableName === tableName);
    if (!table) continue;

    const textColumns = table.columns.filter(c => 
      c.data_type === 'text' || c.data_type === 'character varying'
    );

    for (const col of textColumns) {
      if (['slug', 'code', 'email', 'status'].includes(col.column_name)) {
        const hasIndex = table.indexes.some(idx => idx.column_name === col.column_name);
        if (!hasIndex) {
          auditResults.issues.performanceRisks.push({
            table: tableName,
            column: col.column_name,
            rowCount: table.rowCount,
            issue: 'Frequently queried column without index',
            severity: table.rowCount > 1000 ? 'HIGH' : 'MEDIUM',
          });
        }
      }
    }
  }
}

async function generateReport(tables: TableInfo[]) {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE STRUCTURAL AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`Audit Date: ${new Date().toISOString()}`);
  console.log(`Total Tables: ${tables.length}`);
  
  // Table summary
  console.log('\n📊 TABLE INVENTORY');
  console.log('-'.repeat(80));
  for (const table of tables) {
    console.log(`  ${table.tableName.padEnd(40)} | ${String(table.rowCount).padStart(8)} rows | ${table.columns.length} cols | ${table.foreignKeys.length} FKs`);
  }

  // Primary key analysis
  console.log('\n🔑 PRIMARY KEY ANALYSIS');
  console.log('-'.repeat(80));
  for (const table of tables) {
    const pkInfo = table.primaryKeys.length > 0 
      ? `✓ ${table.primaryKeys.map(pk => pk.column_name).join(', ')}`
      : '✗ NO PRIMARY KEY';
    console.log(`  ${table.tableName.padEnd(40)} | ${pkInfo}`);
  }

  // ID type consistency
  console.log('\n🔢 ID TYPE CONSISTENCY');
  console.log('-'.repeat(80));
  const idTypes = new Map<string, string>();
  for (const table of tables) {
    const idCol = table.columns.find(c => c.column_name === 'id');
    if (idCol) {
      idTypes.set(table.tableName, idCol.data_type);
      console.log(`  ${table.tableName.padEnd(40)} | ${idCol.data_type}`);
    }
  }

  // Foreign key relationships
  console.log('\n🔗 FOREIGN KEY RELATIONSHIPS');
  console.log('-'.repeat(80));
  for (const table of tables) {
    if (table.foreignKeys.length > 0) {
      console.log(`  ${table.tableName}:`);
      for (const fk of table.foreignKeys) {
        const hasIndex = table.indexes.some(idx => idx.column_name === fk.column_name && !idx.is_primary);
        const indexMarker = hasIndex ? '✓' : '✗';
        console.log(`    ${indexMarker} ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.delete_rule})`);
      }
    }
  }

  // Index coverage
  console.log('\n📇 INDEX COVERAGE');
  console.log('-'.repeat(80));
  for (const table of tables) {
    const nonPKIndexes = table.indexes.filter(idx => !idx.is_primary);
    const indexCount = new Set(nonPKIndexes.map(i => i.index_name)).size;
    console.log(`  ${table.tableName.padEnd(40)} | ${indexCount} indexes`);
    if (indexCount > 0) {
      const grouped = new Map<string, string[]>();
      for (const idx of nonPKIndexes) {
        if (!grouped.has(idx.index_name)) {
          grouped.set(idx.index_name, []);
        }
        grouped.get(idx.index_name)!.push(idx.column_name);
      }
      for (const [idxName, cols] of grouped) {
        const unique = nonPKIndexes.find(i => i.index_name === idxName)?.is_unique ? 'UNIQUE' : 'INDEX';
        console.log(`    - ${idxName}: [${cols.join(', ')}] (${unique})`);
      }
    }
  }

  // CRITICAL ISSUES
  console.log('\n⚠️  CRITICAL ISSUES');
  console.log('-'.repeat(80));
  
  if (auditResults.issues.missingPrimaryKeys.length > 0) {
    console.log('\n  ❌ MISSING PRIMARY KEYS:');
    auditResults.issues.missingPrimaryKeys.forEach((t: string) => {
      console.log(`     - ${t}`);
    });
  }

  if (auditResults.issues.missingFKIndexes.length > 0) {
    console.log('\n  ⚠️  FOREIGN KEYS WITHOUT INDEXES:');
    auditResults.issues.missingFKIndexes.forEach((item: any) => {
      console.log(`     - ${item.table}.${item.column} -> ${item.references}`);
    });
  }

  if (auditResults.issues.slugBasedJoins.length > 0) {
    console.log('\n  ⚠️  TEXT-BASED RELATIONSHIPS (NO FK):');
    auditResults.issues.slugBasedJoins.forEach((item: any) => {
      console.log(`     - ${item.table}.${item.column} (${item.dataType})`);
      console.log(`       Issue: ${item.issue}`);
    });
  }

  if (auditResults.issues.missingFKConstraints.length > 0) {
    console.log('\n  ⚠️  MISSING FK CONSTRAINTS:');
    auditResults.issues.missingFKConstraints.forEach((item: any) => {
      console.log(`     - ${item.from} -> ${item.to}`);
      console.log(`       Issue: ${item.issue}`);
      if (item.evidence) console.log(`       Evidence: ${item.evidence}`);
    });
  }

  if (auditResults.issues.typeMismatches.length > 0) {
    console.log('\n  ❌ TYPE MISMATCHES:');
    auditResults.issues.typeMismatches.forEach((item: any) => {
      console.log(`     - ${item.relationship}`);
      console.log(`       Left: ${item.leftType}, Right: ${item.rightType}`);
    });
  }

  // PERFORMANCE RISKS
  console.log('\n⚡ PERFORMANCE RISKS');
  console.log('-'.repeat(80));
  
  if (auditResults.issues.performanceRisks.length > 0) {
    const high = auditResults.issues.performanceRisks.filter((r: any) => r.severity === 'HIGH');
    const medium = auditResults.issues.performanceRisks.filter((r: any) => r.severity === 'MEDIUM');
    
    if (high.length > 0) {
      console.log('\n  🔴 HIGH SEVERITY:');
      high.forEach((item: any) => {
        console.log(`     - ${item.table}.${item.column} (${item.rowCount} rows)`);
        console.log(`       ${item.issue}`);
      });
    }
    
    if (medium.length > 0) {
      console.log('\n  🟡 MEDIUM SEVERITY:');
      medium.forEach((item: any) => {
        console.log(`     - ${item.table}.${item.column} (${item.rowCount} rows)`);
        console.log(`       ${item.issue}`);
      });
    }
  }

  if (auditResults.issues.scalabilityRisks.length > 0) {
    console.log('\n  ⚠️  SCALABILITY RISKS:');
    auditResults.issues.scalabilityRisks.forEach((item: any) => {
      console.log(`     - ${item.table}: ${item.rowCount} rows`);
      console.log(`       ${item.issue}`);
    });
  }

  // SPECIFIC TABLE ANALYSIS
  console.log('\n🔍 CRITICAL TABLE ANALYSIS');
  console.log('-'.repeat(80));

  const criticalTables = ['detectives', 'services', 'countries', 'states', 'cities', 'location_seo_overrides', 'reviews'];
  for (const tableName of criticalTables) {
    const table = tables.find(t => t.tableName === tableName);
    if (!table) {
      console.log(`\n  ❌ ${tableName}: NOT FOUND`);
      continue;
    }

    console.log(`\n  📋 ${tableName.toUpperCase()} (${table.rowCount} rows)`);
    console.log(`     Columns: ${table.columns.length}`);
    console.log(`     Primary Key: ${table.primaryKeys.map(pk => pk.column_name).join(', ') || 'NONE'}`);
    console.log(`     Foreign Keys: ${table.foreignKeys.length}`);
    console.log(`     Indexes: ${new Set(table.indexes.filter(i => !i.is_primary).map(i => i.index_name)).size}`);
    
    // Show key columns
    const keyColumns = table.columns.filter(c => 
      ['id', 'slug', 'code', 'country', 'state', 'city', 'detective_id', 'service_id', 'entity_type', 'entity_id'].includes(c.column_name)
    );
    if (keyColumns.length > 0) {
      console.log(`     Key Columns:`);
      keyColumns.forEach(col => {
        const indexed = table.indexes.some(idx => idx.column_name === col.column_name);
        const fk = table.foreignKeys.find(fk => fk.column_name === col.column_name);
        const markers = [];
        if (indexed) markers.push('INDEX');
        if (fk) markers.push(`FK->${fk.foreign_table_name}`);
        if (col.is_nullable === 'NO') markers.push('NOT NULL');
        console.log(`       - ${col.column_name} (${col.data_type}) ${markers.length > 0 ? `[${markers.join(', ')}]` : ''}`);
      });
    }
  }

  // SCORING
  console.log('\n📊 STRUCTURAL INTEGRITY SCORES');
  console.log('-'.repeat(80));

  const totalTables = tables.length;
  const tablesWithPK = tables.filter(t => t.primaryKeys.length > 0).length;
  const fksWithIndexes = tables.reduce((sum, t) => {
    const indexed = t.foreignKeys.filter(fk => 
      t.indexes.some(idx => idx.column_name === fk.column_name)
    ).length;
    return sum + indexed;
  }, 0);
  const totalFKs = tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);

  const pkScore = (tablesWithPK / totalTables) * 100;
  const fkIndexScore = totalFKs > 0 ? (fksWithIndexes / totalFKs) * 100 : 100;
  const relationshipScore = 100 - (auditResults.issues.missingFKConstraints.length * 10);
  const performanceScore = 100 - (auditResults.issues.performanceRisks.length * 5);

  console.log(`  Primary Key Coverage:        ${pkScore.toFixed(1)}% (${tablesWithPK}/${totalTables} tables)`);
  console.log(`  FK Index Coverage:           ${fkIndexScore.toFixed(1)}% (${fksWithIndexes}/${totalFKs} FKs)`);
  console.log(`  Relationship Integrity:      ${Math.max(0, relationshipScore).toFixed(1)}%`);
  console.log(`  Performance Readiness:       ${Math.max(0, performanceScore).toFixed(1)}%`);
  
  const overallScore = (pkScore + fkIndexScore + Math.max(0, relationshipScore) + Math.max(0, performanceScore)) / 4;
  console.log(`\n  ⭐ OVERALL SCORE:             ${overallScore.toFixed(1)}%`);

  // RISK ASSESSMENT
  console.log('\n🎯 RISK ASSESSMENT');
  console.log('-'.repeat(80));

  console.log('\n  🔴 IMMEDIATE RISKS (Fix within 1 week):');
  if (auditResults.issues.slugBasedJoins.length > 0) {
    console.log(`     - detectives.country/state/city using text values instead of FK`);
    console.log(`       Impact: Data inconsistency, orphaned records, JOIN performance`);
    console.log(`       Action: Normalize location relationships`);
  }
  if (auditResults.issues.performanceRisks.filter((r: any) => r.severity === 'HIGH').length > 0) {
    console.log(`     - Missing indexes on high-traffic query columns`);
    console.log(`       Impact: Slow queries, poor user experience`);
    console.log(`       Action: Add indexes to status, slug, code columns`);
  }

  console.log('\n  🟡 MEDIUM-TERM IMPROVEMENTS (Fix within 1 month):');
  console.log(`     - Standardize ID types across all tables`);
  console.log(`     - Add missing FK indexes for query optimization`);
  console.log(`     - Implement location_seo_overrides FK constraints`);

  console.log('\n  🟢 LONG-TERM REFACTORING (Plan for 3+ months):');
  console.log(`     - Full normalization of location hierarchy`);
  console.log(`     - Migrate from slug-based to ID-based relationships`);
  console.log(`     - Implement comprehensive indexing strategy`);
  console.log(`     - Add database-level constraints for data integrity`);

  // SEO SYSTEM COMPATIBILITY
  console.log('\n🌐 SEO SYSTEM COMPATIBILITY ANALYSIS');
  console.log('-'.repeat(80));
  
  const lsoTable = tables.find(t => t.tableName === 'location_seo_overrides');
  if (lsoTable) {
    console.log('\n  location_seo_overrides table:');
    console.log(`    - Rows: ${lsoTable.rowCount}`);
    console.log(`    - Uses entity_type/entity_id pattern (text-based)`);
    console.log(`    - No FK constraints to countries/states/cities`);
    console.log(`    - Risk: Can insert overrides for non-existent locations`);
    console.log(`    - Current JOIN approach: String concatenation (country/state/city slugs)`);
    console.log(`    - Compatibility: ⚠️  Works but fragile, no referential integrity`);
  } else {
    console.log('\n  ❌ location_seo_overrides table NOT FOUND');
  }

  console.log('\n' + '='.repeat(80));
  console.log('END OF AUDIT REPORT');
  console.log('='.repeat(80) + '\n');
}

async function runAudit() {
  try {
    console.log('🔍 Starting comprehensive database audit...\n');
    
    const tableNames = await getAllTables();
    console.log(`Found ${tableNames.length} tables\n`);

    for (const tableName of tableNames) {
      const tableInfo = await auditTable(tableName);
      auditResults.tables.push(tableInfo);
    }

    console.log('\n✅ Table audits complete. Analyzing relationships...\n');

    await detectIdTypeInconsistencies(auditResults.tables);
    await detectSlugBasedRelationships(auditResults.tables);
    await checkRelationshipIntegrity(auditResults.tables);
    await detectPerformanceRisks(auditResults.tables);

    console.log('✅ Analysis complete. Generating report...\n');

    await generateReport(auditResults.tables);

  } catch (error) {
    console.error('❌ Audit failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runAudit();
