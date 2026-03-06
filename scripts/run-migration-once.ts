#!/usr/bin/env node
/**
 * One-time migration runner for production
 * Usage: node --loader ts-node/esm scripts/run-migration-once.ts
 * 
 * This script is designed to be run ONCE after deployment to create
 * the performance indexes. It will exit if the migration has already been run.
 */

import { runMigrations } from '../db/run-migrations.js';

console.log('🔧 One-time migration runner starting...\n');
console.log('This will run all pending migrations, including creating performance indexes.');
console.log('CREATE INDEX CONCURRENTLY operations may take 5-15 minutes on large tables.\n');

runMigrations()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
