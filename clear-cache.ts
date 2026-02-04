import { cache } from "./server/app.ts";

const detectiveId = '108db626-e2f6-4d0e-be6c-8aefd3d93e8d';

// Clear all relevant cache entries
const keysToDelete = [
  `detective:public:${detectiveId}`,
  'services:search:category=&country=&limit=50&maxPrice=&minPrice=&minRating=&offset=&search=&sortBy=',
  'services:search:category=&country=&limit=8&maxPrice=&minPrice=&minRating=&offset=&search=&sortBy=recent',
];

console.log('Clearing cache entries...');
keysToDelete.forEach(key => {
  cache.del(key);
  console.log(`✅ Cleared: ${key}`);
});

console.log('\n✨ Cache cleared! Reload the page to see updated data.');
process.exit(0);
