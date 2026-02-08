import * as cache from "./server/lib/cache.ts";

// Get detective ID from command-line arguments
const detectiveId = process.argv[2];

if (!detectiveId) {
  console.error('ERROR: Detective ID is required');
  console.error('Usage: npx tsx clear-cache.ts <detectiveId>');
  process.exit(1);
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(detectiveId)) {
  console.error('ERROR: Invalid UUID format for detective ID');
  process.exit(1);
}

// Clear all relevant cache entries
console.log(`Clearing cache entries for detective: ${detectiveId}...`);

// Clear detective-specific entry
const detectiveKey = `detective:public:${detectiveId}`;
const deletedDetective = cache.del(detectiveKey);
if (deletedDetective) {
  console.log(`✅ Cleared: ${detectiveKey}`);
} else {
  console.log(`⚠️  Not cached: ${detectiveKey}`);
}

// Clear all services:search:* cache keys
const allKeys = cache.keys();
const serviceKeys = allKeys.filter((k) => k.startsWith('services:search:'));
if (serviceKeys.length > 0) {
  console.log(`\nClearing ${serviceKeys.length} search cache entries...`);
  serviceKeys.forEach(key => {
    try {
      cache.del(key);
      console.log(`✅ Cleared: ${key}`);
    } catch (error) {
      console.error(`❌ Failed to delete: ${key}`, error);
    }
  });
} else {
  console.log('\n📝 No search cache entries to clear');
}

console.log('\n✨ Cache cleared! Reload the page to see updated data.');
process.exit(0);
