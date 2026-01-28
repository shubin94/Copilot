#!/usr/bin/env node

const BASE_URL = "http://localhost:5000";
const ADMIN_EMAIL = "superadmin+e7vlQEjw@example.com";
const ADMIN_PASSWORD = "vGnoTlUeBAqQLvSpVNQGC0SYCDCRu8Eg!#";

async function test() {
  console.log("🧪 Testing Email Template System\n");
  console.log("1️⃣  Authenticating as admin...");
  
  try {
    // Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });

    if (!loginRes.ok) {
      const error = await loginRes.text();
      console.error("❌ Login failed:", loginRes.status, error);
      process.exit(1);
    }

    const cookies = loginRes.headers.get("set-cookie");
    console.log("✅ Logged in successfully\n");

    // Test endpoint
    console.log("2️⃣  Calling test endpoint...\n");
    
    const testRes = await fetch(`${BASE_URL}/api/admin/email-templates/test-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookies || "",
      },
    });

    if (!testRes.ok) {
      const error = await testRes.text();
      console.error("❌ Test failed:", testRes.status);
      console.error(error);
      process.exit(1);
    }

    const result = await testRes.json();

    // Display results
    console.log("📊 TEST RESULTS:");
    console.log("─────────────────────");
    console.log(`Total templates: ${result.total}`);
    console.log(`✅ Successful: ${result.success}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log(`Test email: ${result.testEmail}`);
    console.log(`Timestamp: ${result.timestamp}\n`);

    if (result.failedTemplates && result.failedTemplates.length > 0) {
      console.log("⚠️  Failed Templates:");
      result.failedTemplates.forEach((t, i) => {
        console.log(`${i + 1}. ${t.key}`);
        console.log(`   Error: ${t.error}\n`);
      });
    }

    // Summary
    console.log("✨ SUMMARY:");
    console.log("─────────────────────");
    if (result.success === result.total) {
      console.log(`🎉 ALL ${result.total} TEMPLATES PASSED!\n`);
    } else {
      console.log(`⚠️  ${result.success}/${result.total} templates passed\n`);
    }

    console.log("📧 Check inbox:", result.testEmail);

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

test();
