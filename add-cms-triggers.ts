import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function addTriggers() {
  const client = await pool.connect();
  try {
    console.log("\n⚡ ADDING AUTO-UPDATE TRIGGERS...\n");
    
    // Create the trigger function
    const functionSQL = `
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    console.log("Creating trigger function...");
    await client.query(functionSQL);
    console.log("✅ Function created\n");
    
    // Create triggers for each table
    const triggers = [
      { table: 'categories', sql: `CREATE TRIGGER categories_update_timestamp BEFORE UPDATE ON categories
       FOR EACH ROW EXECUTE FUNCTION update_timestamp();` },
      { table: 'tags', sql: `CREATE TRIGGER tags_update_timestamp BEFORE UPDATE ON tags
       FOR EACH ROW EXECUTE FUNCTION update_timestamp();` },
      { table: 'pages', sql: `CREATE TRIGGER pages_update_timestamp BEFORE UPDATE ON pages
       FOR EACH ROW EXECUTE FUNCTION update_timestamp();` }
    ];
    
    for (const triggerObj of triggers) {
      console.log(`Creating trigger for ${triggerObj.table}...`);
      try {
        await client.query(triggerObj.sql);
        console.log(`✅ Trigger created\n`);
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          console.log(`ℹ️  Trigger already exists\n`);
        } else {
          throw err;
        }
      }
    }
    
    console.log("✅ ALL TRIGGERS CREATED SUCCESSFULLY!\n");
    
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

addTriggers();
