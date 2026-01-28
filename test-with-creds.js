#!/usr/bin/env node
/**
 * Email Template Test - Direct Approach
 * Tests the endpoint with the admin credentials provided by the user
 */

const BASE_URL = "http://localhost:5000";

async function testEndpoint() {
  console.log("🧪 Testing Email Template System\n");

  // Get cookies by logging in
  console.log("1️⃣  Authenticating...");
  
  const adminEmail = "superadmin+e7vlQEjw@example.com";
  const adminPassword = "vGnoTlUeBAqQLvSpVNQGC0SYCDCRu8Eg!#";

  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        email: adminEmail.trim(),
        password: adminPassword.trim(),
      }),
    });

    console.log(`   Status: ${loginRes.status}`);
    const loginText = await loginRes.text();
    console.log(`   Response: ${loginText.substring(0, 100)}`);

    if (!loginRes.ok) {
      console.error(`❌ Login failed\n`);
      console.error("Response:", loginText);
      return;
    }

    const loginData = JSON.parse(loginText);
    console.log("✅ Authenticated\n");
    console.log("User:", loginData.user?.email || loginData.user?.id);

    // Get session cookies
    const cookies = loginRes.headers.get("set-cookie");
    console.log("Session cookie:", cookies ? "✓" : "✗");
    console.log("");

    // Call test endpoint
    console.log("2️⃣  Testing templates...\n");

    const testRes = await fetch(`${BASE_URL}/api/admin/email-templates/test-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookies || "",
      },
    });

    console.log(`   Status: ${testRes.status}`);

    if (!testRes.ok) {
      const errorText = await testRes.text();
      console.error(`❌ Test failed\n`);
      console.error("Error:", errorText);
      return;
    }

    const result = await testRes.json();

    // Display results
    console.log("\n📊 RESULTS:");
    console.log("───────────────────────────────");
    console.log(`Total templates: ${result.total}`);
    console.log(`✅ Passed: ${result.success}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log(`Test email: ${result.testEmail}`);
    console.log("");

    if (result.failedTemplates && result.failedTemplates.length > 0) {
      console.log("⚠️  FAILED TEMPLATES:");
      result.failedTemplates.forEach((t, i) => {
        console.log(`${i + 1}. ${t.key}`);
        console.log(`   Error: ${t.error}\n`);
      });
    }

    // Summary
    console.log("✨ SUMMARY:");
    console.log("───────────────────────────────");
    if (result.success === result.total) {
      console.log(`🎉 SUCCESS! All ${result.total} templates passed!\n`);
    } else if (result.success > 0) {
      console.log(`⚠️  Partial Success: ${result.success}/${result.total}\n`);
    } else {
      console.log("❌ All tests failed\n");
    }

    console.log(`📧 Check inbox: ${result.testEmail}`);
    console.log(`⏱️  Completed: ${result.timestamp}`);

  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err);
  }
}

testEndpoint();
