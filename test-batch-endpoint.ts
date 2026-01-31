import fetch from "node-fetch";

const baseUrl = "http://localhost:5000";

async function test() {
  try {
    console.log("[Test] Testing email batch endpoint...\n");

    // Call the test-all email endpoint
    console.log("📧 Calling POST /api/admin/email-templates/test-all");
    const testRes = await fetch(`${baseUrl}/api/admin/email-templates/test-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!testRes.ok) {
      console.error("❌ Test endpoint failed:", testRes.status);
      const errorText = await testRes.text();
      console.error("Error:", errorText);
      process.exit(1);
    }

    const result = await testRes.json();
    console.log("\n✅ Response received:");
    console.log(`  Total templates: ${result.total}`);
    console.log(`  Successful: ${result.success}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Test email: ${result.testEmail}`);
    console.log(`  Timestamp: ${result.timestamp}\n`);

    if (result.success > 0) {
      console.log("✅ EMAILS SENT SUCCESSFULLY!");
    }

    if (result.failedTemplates && result.failedTemplates.length > 0) {
      console.log("\n⚠️ Failed templates:");
      result.failedTemplates.forEach((t: any) => {
        console.log(`  - ${t.key}: ${t.error}`);
      });
    }

    process.exit(result.success > 0 ? 0 : 1);
  } catch (error) {
    console.error("[Test] Error:", error);
    process.exit(1);
  }
}

test();
