import fetch from "node-fetch";

async function testEmailSending() {
  const baseUrl = "http://localhost:5000";

  try {
    // SECURITY: Use environment variables for test credentials
    const adminEmail = process.env.TEST_ADMIN_EMAIL;
    const adminPassword = process.env.TEST_ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      console.error("[Test] ERROR: TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set");
      console.error("Usage: TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD=pass tsx test-email-endpoint.ts");
      process.exit(1);
    }
    
    // Step 1: Login as admin to get session
    console.log("[Test] Step 1: Logging in as admin...");
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
    });

    if (!loginRes.ok) {
      console.error("[Test] Login failed:", await loginRes.text());
      process.exit(1);
    }

    console.log("[Test] ✅ Login successful");

    // Step 2: Call the test-all email endpoint
    console.log("[Test] Step 2: Calling /api/admin/email-templates/test-all...");
    const testRes = await fetch(`${baseUrl}/api/admin/email-templates/test-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!testRes.ok) {
      console.error("[Test] Test endpoint failed:", testRes.status, await testRes.text());
      process.exit(1);
    }

    const result = await testRes.json();
    console.log("[Test] ✅ Test endpoint response:");
    console.log(JSON.stringify(result, null, 2));

    if (result.success === 0) {
      console.log("\n❌ No emails were sent successfully");
    } else {
      console.log(`\n✅ ${result.success} emails sent successfully!`);
    }

    if (result.failedTemplates && result.failedTemplates.length > 0) {
      console.log("\n⚠️ Failed templates:");
      result.failedTemplates.forEach((t: any) => {
        console.log(`  - ${t.key}: ${t.error}`);
      });
    }
  } catch (error) {
    console.error("[Test] Error:", error);
    process.exit(1);
  }
}

testEmailSending();
