#!/usr/bin/env node
/**
 * Test Email Templates Endpoint
 * 
 * This script tests the POST /api/admin/email-templates/test-all endpoint
 * It sends a test email for every template in the system to contact@askdetectives.com
 * 
 * Usage:
 *   node test-email-templates.js [admin-email] [admin-password]
 */

import fetch from "node-fetch";

const BASE_URL = "http://localhost:5000";
const adminEmail = process.argv[2] || "admin@example.com";
const adminPassword = process.argv[3] || "Admin@12345";

console.log("🧪 Email Template Test Suite");
console.log("============================\n");
console.log("Target: POST /api/admin/email-templates/test-all");
console.log("Admin User:", adminEmail);
console.log("Base URL:", BASE_URL);
console.log("");

let sessionCookie = "";

/**
 * Step 1: Authenticate as admin
 */
async function authenticate() {
  console.log("📋 Step 1: Authenticating as admin...");

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Authentication failed:", error);
      return false;
    }

    // Extract session cookie from Set-Cookie header
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      sessionCookie = setCookie.split(";")[0];
      console.log("✅ Authentication successful");
      console.log("   Session cookie:", sessionCookie.substring(0, 50) + "...");
      return true;
    } else {
      console.error("❌ No session cookie received");
      return false;
    }
  } catch (error) {
    console.error("❌ Authentication error:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Step 2: Call test-all endpoint
 */
async function testAllTemplates() {
  console.log("\n🚀 Step 2: Triggering email template test batch...");

  try {
    const response = await fetch(`${BASE_URL}/api/admin/email-templates/test-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": sessionCookie,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Test failed:", error);
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("❌ Test error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Step 3: Display results
 */
function displayResults(result: any) {
  if (!result) {
    console.error("❌ No results to display");
    return;
  }

  console.log("\n📊 Test Results");
  console.log("================");
  console.log(`Total templates: ${result.total}`);
  console.log(`✅ Success: ${result.success}`);
  console.log(`❌ Failed: ${result.failed}`);
  console.log(`Test email: ${result.testEmail}`);
  console.log(`Timestamp: ${result.timestamp}`);

  if (result.failedTemplates && result.failedTemplates.length > 0) {
    console.log("\n⚠️  Failed Templates:");
    result.failedTemplates.forEach((template: any, idx: number) => {
      console.log(`  ${idx + 1}. ${template.key} (${template.name})`);
      console.log(`     Error: ${template.error}`);
    });
  }

  console.log("\n📧 Next Steps:");
  console.log("1. Check contact@askdetectives.com for test emails");
  console.log("2. Verify images load correctly in emails");
  console.log("3. Check that variables (userName, amount, etc.) are rendered");
  console.log("4. Review server logs for any warnings about relative image URLs");
  console.log("5. If templates failed, check SendPulse template IDs in database");

  if (result.success === result.total) {
    console.log("\n✅ All templates tested successfully!");
  } else if (result.failed > 0) {
    console.log(`\n⚠️  ${result.failed} template(s) failed. Review errors above.`);
  }
}

/**
 * Main execution
 */
async function main() {
  const authenticated = await authenticate();
  if (!authenticated) {
    console.log("\n❌ Could not authenticate. Aborting test.");
    process.exit(1);
  }

  const result = await testAllTemplates();
  if (result) {
    displayResults(result);
    process.exit(0);
  } else {
    console.log("\n❌ Test failed. Aborting.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
