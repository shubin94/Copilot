const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");

client.connect().then(() => {
  client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `).then(res => {
    console.log("📋 Tables in database:");
    res.rows.forEach(row => console.log(`  - ${row.table_name}`));
    client.end();
  }).catch(e => {
    console.log("Error:", e.message);
    client.end();
  });
});
