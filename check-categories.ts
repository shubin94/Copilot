import { pool } from "./db/index.ts";

async function checkCategories() {
  const result = await pool.query(
    SELECT 
      c.id, 
      c.name, 
      c.slug,
      c.parent_id,
      p.name as parent_name,
      p.slug as parent_slug
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.id
    ORDER BY c.name
  );
  
  console.log("Categories structure:");
  for (const row of result.rows) {
    if (row.parent_id) {
      console.log(\  \ (slug: \) -> Parent: \ (slug: \)\);
    } else {
      console.log(\\ (slug: \)\);
    }
  }
  process.exit(0);
}

checkCategories().catch(console.error);
