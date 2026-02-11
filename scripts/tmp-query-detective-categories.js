const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const detectiveName = "Silent Clue Detective";
const sql = "select s.category, count(*)::int as service_count from services s join detectives d on s.detective_id = d.id where d.business_name = $1 group by s.category order by service_count desc, s.category asc";

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(sql, [detectiveName]);
  console.log(JSON.stringify(result.rows, null, 2));
  await client.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
