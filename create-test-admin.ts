import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";
import bcrypt from "bcrypt";

async function createTestAdmin() {
  try {
    const email = "testadmin@test.com";
    const password = "TestAdmin123!";
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if already exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      console.log(`✅ Admin user already exists: ${email}`);
      console.log(`Password: ${password}`);
      process.exit(0);
    }

    const result = await pool.query(
      `INSERT INTO users (email, password, name, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)
       RETURNING id, email, role`,
      [email, hashedPassword, "Test Admin"]
    );

    console.log("✅ Created test admin user:");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`ID: ${result.rows[0].id}`);
    
    process.exit(0);
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

createTestAdmin();
