#!/usr/bin/env npx tsx

// Safety guard - prevent running against production (BEFORE any imports that may open connections)
if (process.env.NODE_ENV === 'production') {
  console.error('❌ This is a test script and cannot run in production');
  process.exit(1);
}

import { pool } from "./db/index.ts";

async function testAccessPages() {
  try {
    console.log("🔍 Testing access_pages setup...\n");

    // 1. Check if tables exist
    console.log("1️⃣  Checking if tables exist...");
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('access_pages', 'user_pages')
      ORDER BY table_name
    `);

    if (tableCheck.rows.length === 0) {
      console.log("❌ Tables don't exist yet");
      process.exit(1);
    }

    const tables = tableCheck.rows.map((r: any) => r.table_name);
    console.log(`✅ Tables exist: ${tables.join(", ")}\n`);

    // 2. Check access_pages data
    console.log("2️⃣  Checking access_pages table...");
    const pagesCheck = await pool.query(
      "SELECT id, key, name, is_active FROM access_pages ORDER BY key"
    );

    if (pagesCheck.rows.length === 0) {
      console.log("❌ access_pages table is empty");
      process.exit(1);
    }

    console.log(`✅ Found ${pagesCheck.rows.length} pages:`);
    pagesCheck.rows.forEach((page: any) => {
      console.log(
        `   - ${page.key.padEnd(20)} (${page.name}) [${page.is_active ? "active" : "inactive"}]`
      );
    });
    console.log();

    // 3. Check admin user exists
    console.log("3️⃣  Checking admin user...");
    const adminCheck = await pool.query(
      "SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (adminCheck.rows.length === 0) {
      console.log("❌ No admin user found");
      process.exit(1);
    }

    const admin = adminCheck.rows[0];
    console.log(`✅ Admin found: ${admin.email}\n`);

    // 4. Create test employee
    console.log("4️⃣  Creating test employee...");
    const testEmail = `emp-test-${Date.now()}@test.com`;
    const testName = "Test Employee";

    const empCheck = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [testEmail]
    );

    if (empCheck.rows.length > 0) {
      console.log(`⚠️  Employee already exists, using existing one`);
    } else {
      // Create employee via API-like logic
      const bcrypt = (await import("bcrypt")).default;
      const hashedPassword = await bcrypt.hash("TestEmp123", 10);

      // Get first 3 page IDs for assignment
      const pagesForAssignment = pagesCheck.rows.slice(0, 3).map((p: any) => p.id);

      const empInsert = await pool.query(
        `INSERT INTO users (email, password, name, role, created_at, updated_at)
         VALUES ($1, $2, $3, 'employee', now(), now())
         RETURNING id, email, name, role`,
        [testEmail, hashedPassword, testName]
      );

      const employee = empInsert.rows[0];
      console.log(`✅ Employee created: ${employee.email}`);

      // Assign pages to employee
      console.log(`   Assigning 3 pages...`);
      for (const pageId of pagesForAssignment) {
        await pool.query(
          `INSERT INTO user_pages (user_id, page_id, granted_by, granted_at)
           VALUES ($1, $2, $3, now())`,
          [employee.id, pageId, admin.id]
        );
      }
      console.log(`✅ Pages assigned\n`);
    }

    // 5. Verify employee setup
    console.log("5️⃣  Verifying employee access...");
    const empAccessCheck = await pool.query(
      `SELECT u.email, u.id, COUNT(p.id) as page_count
       FROM users u
       LEFT JOIN user_pages p ON u.id = p.user_id
       WHERE u.email = $1
       GROUP BY u.id, u.email`,
      [testEmail]
    );

    if (empAccessCheck.rows.length > 0) {
      const emp = empAccessCheck.rows[0];
      console.log(`✅ Employee: ${emp.email}`);
      console.log(`   Pages assigned: ${emp.page_count}\n`);

      // Show which pages they have
      const pageAccessCheck = await pool.query(
        `SELECT ap.key, ap.name, ap.is_active
         FROM user_pages up
         JOIN access_pages ap ON up.page_id = ap.id
         WHERE up.user_id = $1
         ORDER BY ap.key`,
        [emp.id]
      );

      if (pageAccessCheck.rows.length > 0) {
        console.log("   Access to:");
        pageAccessCheck.rows.forEach((p: any) => {
          console.log(`   ✓ ${p.key.padEnd(20)} (${p.name})`);
        });
      }
    }

    console.log("\n✅ All checks passed! Employee access pages are working correctly!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testAccessPages();
