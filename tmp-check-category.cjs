const { Client } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  const cat = await c.query(
    "select id,name from service_categories where lower(name) like '%pre-marriage%' or lower(name) like '%pre-marital%' limit 5"
  );
  console.log("service_categories:", cat.rows);
  const svc = await c.query(
    "select id,title,category,is_active from services where lower(category) like '%pre-marriage%' or lower(category) like '%pre-marital%' limit 10"
  );
  console.log("services:", svc.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
