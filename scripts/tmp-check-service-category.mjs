import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const serviceId = "0cc10bc2-9941-476f-8598-f002868034e1";

const queries = {
  service: "select id, category from services where id = $1",
  categoryTable: "select id, name from service_categories where name ilike 'Pre-mar%'",
};

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const service = await client.query(queries.service, [serviceId]);
  const categoryTable = await client.query(queries.categoryTable);
  console.log(
    JSON.stringify(
      {
        service: service.rows,
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
