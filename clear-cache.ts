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
const keysToDelete = [
  `detective:public:${detectiveId}`,
  'services:search:category=&country=&limit=50&maxPrice=&minPrice=&minRating=&offset=&search=&sortBy=',
  'services:search:category=&country=&limit=8&maxPrice=&minPrice=&minRating=&offset=&search=&sortBy=recent',
];

console.log(`Clearing cache entries for detective: ${detectiveId}...`);
keysToDelete.forEach(key => {
  try {
    const deleted = cache.del(key);
    if (deleted) {
      console.log(`✅ Cleared: ${key}`);
    } else {
      console.log(`⚠️  Not found: ${key}`);
    }
  } catch (error) {
    console.error(`❌ Failed to delete: ${key}`, error);
  }
});

console.log('\n✨ Cache cleared! Reload the page to see updated data.');
process.exit(0);
