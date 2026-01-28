#!/usr/bin/env node
/**
 * Simple Email Template Test
 * Tests the POST /api/admin/email-templates/test-all endpoint
 */

const BASE_URL = "http://localhost:5000";

// Try multiple known credentials
const credentials = [
  { email: "superadmin+e7vlQEjw@example.com", password: "vGnoTlUeBAqQLvSpVNQGC0SYCDCRu8Eg!#" },
  { email: "admin@finddetectives.com", password: "admin123" },
  { email: "admin@askdetectives.com", password: "admin123" },
];

async function tryLogin(email, password) {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const cookie = res.headers.get("set-cookie");
      console.log(`✅ Login successful with: ${email}`);
      return { success: true, email, cookie };
    }
    return { success: false, email };
  } catch (err) {
    return { success: false, email, error: err.message };
  }
}

async function testTemplates(cookie) {
  const res = await fetch(`${BASE_URL}/api/admin/email-templates/test-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Cookie": cookie || "",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}

async function main() {
  console.log("🧪 Email Template Test\n");
  console.log("Trying admin credentials...\n");

  let loginResult = null;

  for (const cred of credentials) {
    process.stdout.write(`  Trying ${cred.email}... `);
    const result = await tryLogin(cred.email, cred.password);
    if (result.success) {
      loginResult = result;
      break;
    }
    console.log("❌");
  }

  if (!loginResult) {
    console.error("❌ Could not login with any credentials");
    process.exit(1);
  }

  console.log(`\n🚀 Running email template tests...\n`);

  try {
    const result = await testTemplates(loginResult.cookie);

    console.log("📊 RESULTS:");
    console.log("─────────────────────────────");
    console.log(`Total templates: ${result.total}`);
    console.log(`✅ Passed: ${result.success}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log(`Test email: ${result.testEmail}`);
    console.log("");

    if (result.failed > 0 && result.failedTemplates) {
      console.log("⚠️  Failed Templates:");
      result.failedTemplates.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.key}`);
        console.log(`     Error: ${t.error}`);
      });
      console.log("");
    }

    if (result.success === result.total) {
      console.log("🎉 SUCCESS! All templates passed!");
    } else if (result.success > 0) {
      console.log(`⚠️  Partial: ${result.success}/${result.total} passed`);
    } else {
      console.log("❌ All templates failed");
    }

    console.log(`\n📧 Check inbox: ${result.testEmail}`);
    console.log(`⏱️  Test completed at: ${result.timestamp}`);

  } catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  }
}

main().catch(console.error);
