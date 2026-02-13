const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");

client.connect().then(() => {
  client.query("SELECT * FROM detectives LIMIT 1").then(res => {
    if (res.rows.length > 0) {
      console.log("Columns in detectives table:");
      console.log(Object.keys(res.rows[0]));
    }
    client.end();
  }).catch(e => {
    console.log("Error:", e.message);
    client.end();
  });
});
