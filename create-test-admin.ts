import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";
import bcrypt from "bcrypt";
import crypto from "crypto";

async function createTestAdmin() {
  try {
    const email = "testadmin@test.com";
    // Read password from environment or generate secure random
    let password = process.env.TEST_ADMIN_PASSWORD;
    if (!password) {
      password = crypto.randomBytes(16).toString('hex');
      console.log("⚠️  TEST_ADMIN_PASSWORD not set, generated random password");
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if already exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      console.log(`✅ Admin user already exists: ${email}`);
      process.exitCode = 0;
      return;
    }

    const result = await pool.query(
      `INSERT INTO users (email, password, name, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)
       RETURNING id, email, role`,
      [email, hashedPassword, "Test Admin"]
    );

    console.log("✅ Created test admin user:");
    console.log(`Email: ${email}`);
    
    // Only show password if explicitly requested via --show-password flag
    if (process.argv.includes('--show-password')) {
      console.log(`Password: ${password}`);
      console.log("⚠️  Save the password securely and remove from logs immediately");
    } else {
      console.log("Password: [generated - pass --show-password to display]");
      console.log("ℹ️  Credentials not persisted; display only when needed with --show-password flag");
    }
    
    console.log(`ID: ${result.rows[0].id}`);
    
    process.exitCode = 0;
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createTestAdmin();
