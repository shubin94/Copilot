#!/usr/bin/env node
/**
 * Test SendPulse Authentication and Template
 */

async function test() {
  const apiId = "c3cc2bb7dd824419487b8a2a39f32176";
  const apiSecret = "720ea7face67a1a478648842dce87181";

  console.log("🔑 Testing SendPulse API\n");
  console.log("1️⃣  Getting access token...\n");

  try {
    // Get token
    const tokenRes = await fetch("https://api.sendpulse.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: apiId,
        client_secret: apiSecret,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const error = await tokenRes.text();
      console.error("❌ Token request failed:", tokenRes.status);
      console.error(error);
      return;
    }

    const tokenData = await tokenRes.json();
    console.log("✅ Access token obtained\n");

    // Try to send email
    console.log("2️⃣  Attempting to send email with template 70532...\n");

    const payload = {
      email: {
        subject: "",
        from: {
          name: "Ask Detectives",
          email: "contact@askdetectives.com",
        },
        to: [{ email: "contact@askdetectives.com" }],
        template: {
          id: 70532,
          variables: {
            userName: "Test User",
            email: "contact@askdetectives.com",
          },
        },
      },
    };

    const sendRes = await fetch("https://api.sendpulse.com/mailing/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`Status: ${sendRes.status} ${sendRes.statusText}\n`);

    const result = await sendRes.text();
    console.log("Response:");
    console.log(result);
    console.log("");

    if (sendRes.ok) {
      console.log("✅ Email API call successful!");
      console.log("📧 Check inbox: contact@askdetectives.com");
    } else {
      console.log("❌ Email API call failed");
      console.log("\n💡 Possible issues:");
      console.log("  - Template ID 70532 doesn't exist in SendPulse");
      console.log("  - Template is not published/active");
      console.log("  - Different SendPulse account");
      console.log("\n📋 Please check your SendPulse dashboard:");
      console.log("  1. Go to Automation → Email Templates");
      console.log("  2. Find your template and check its ID");
      console.log("  3. Make sure it's published");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

test();
