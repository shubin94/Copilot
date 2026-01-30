import { pool } from "./db/index.ts";

async function run() {
  const result = await pool.query(
    "SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'pages' AND column_name = 'banner_image'"
  );
  console.log(result.rows);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
