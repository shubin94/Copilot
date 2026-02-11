import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const detectiveName = "Silent Clue Detective";

const queries = {
  detectiveCategories:
    "select s.category, count(1)::int as service_count from services s join detectives d on s.detective_id = d.id where d.business_name = $1 group by s.category order by service_count desc, s.category asc",
  postMaritalServices:
    "select category, count(1)::int as service_count from services where category ilike 'Post-mar%' group by category order by category asc",
  categoryTable:
    "select name from service_categories where name ilike 'Post-mar%' order by name asc",
};

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const detectiveCategories = await client.query(
    queries.detectiveCategories,
    [detectiveName]
  );
  const postMaritalServices = await client.query(queries.postMaritalServices);
  const categoryTable = await client.query(queries.categoryTable);

  console.log(
    JSON.stringify(
      {
        detectiveCategories: detectiveCategories.rows,
        postMaritalServices: postMaritalServices.rows,
        categoryTable: categoryTable.rows,
      },
      null,
      2
    )
  );
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
