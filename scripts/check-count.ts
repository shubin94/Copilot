import { storage } from "../server/storage";

async function run() {
  const q = process.argv[2] || "Surveillance";
  const search = await storage.searchServices({ searchQuery: q }, 500, 0, "recent");
  const exact = await storage.searchServices({ category: q }, 500, 0, "recent");
  console.log(JSON.stringify({ query: q, contains_count: search.length, category_exact_count: exact.length }));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
