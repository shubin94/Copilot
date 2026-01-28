#!/usr/bin/env node
/**
 * Email Trigger Test for Detective
 * Tests if emails are sent when events occur for a specific detective
 */

const detectiveId = "23dac06d-afc2-41f3-b941-eb48b0641d45";
const baseUrl = "http://localhost:5000";

async function test() {
  console.log("🧪 Testing Email Triggers for Detective");
  console.log("=====================================\n");
  console.log(`Detective ID: ${detectiveId}\n`);

  // 1. Fetch detective details
  console.log("📋 Step 1: Fetching detective details...");
  
  try {
    const detRes = await fetch(`${baseUrl}/api/detectives/${detectiveId}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });

    if (!detRes.ok) {
      console.error(`❌ Failed to fetch detective: ${detRes.status}`);
      process.exit(1);
    }

    const detData = await detRes.json();
    const detective = detData.detective;

    console.log(`✅ Found: ${detective.fullName}`);
    console.log(`   Email: ${detective.email}`);
    console.log(`   Status: ${detective.status}`);
    console.log(`   Subscription: ${detective.subscription || "none"}`);
    console.log("");

    // 2. Check what can trigger emails
    console.log("📧 Potential Email Triggers:");
    console.log("──────────────────────────────");
    
    const triggers = [];

    // Check if we can update profile (triggers email notification)
    triggers.push({
      name: "Profile Update",
      description: "Update detective profile → should trigger profile update email",
      endpoint: `/api/detectives/${detectiveId}`,
      method: "PATCH",
      body: { about: `Updated about - ${new Date().toISOString()}` },
      requiresAuth: true
    });

    // Check if we can update services (triggers notification)
    triggers.push({
      name: "Service Update",
      description: "Add/update detective services → should trigger service change email",
      endpoint: `/api/detectives/${detectiveId}/services`,
      method: "POST",
      body: { categoryId: "missing-persons", pricePerHour: 150, availability: "available" },
      requiresAuth: true
    });

    // Check visible/ranking changes
    triggers.push({
      name: "Visibility Change",
      description: "Change detective visibility/ranking → admin notification",
      endpoint: `/api/admin/visibility`,
      method: "POST",
      body: { detectiveId: detectiveId, isVisible: true, isFeatured: false },
      requiresAuth: true,
      requiresAdmin: true
    });

    triggers.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`);
      console.log(`   ${t.description}`);
      console.log(`   Endpoint: ${t.method} ${t.endpoint}`);
      console.log("");
    });

    // 3. Show what to check
    console.log("✨ To Test Email Triggering:");
    console.log("──────────────────────────────");
    console.log("1. Make API call to trigger an event");
    console.log("2. Check server console logs for:");
    console.log("   - '[SendPulse] Email sent successfully'");
    console.log("   - '[Email] Failed to send'");
    console.log("   - Or check the inbox: " + detective.email);
    console.log("");
    
    console.log("📌 Example Test:");
    console.log("──────────────────────────────");
    console.log("curl -X PATCH http://localhost:5000/api/detectives/" + detectiveId);
    console.log("  -H 'Content-Type: application/json'");
    console.log("  -H 'X-Requested-With: XMLHttpRequest'");
    console.log("  -d '{\"about\": \"Testing email triggers\"}'");
    console.log("");

    console.log("🔍 Check Server Logs:");
    console.log("──────────────────────────────");
    console.log("Look for messages like:");
    console.log("  ✓ '[SendPulse] Email sent successfully to <email>'");
    console.log("  ✓ '[SendPulse] DEV MODE - Email not sent'");
    console.log("  ✗ '[SendPulse] Failed to send email'");
    console.log("");

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

test();
