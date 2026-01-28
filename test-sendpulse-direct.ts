#!/usr/bin/env node
/**
 * Direct SendPulse API Test
 * Test if template 70578 exists and can send
 */

async function testSendPulse() {
  console.log("🧪 Testing SendPulse API Directly");
  console.log("==================================\n");

  const apiId = process.env.SENDPULSE_API_ID;
  const apiSecret = process.env.SENDPULSE_API_SECRET;
  const senderEmail = process.env.SENDPULSE_SENDER_EMAIL;

  console.log("Configuration:");
  console.log(`API ID: ${apiId ? "✅ SET" : "❌ MISSING"}`);
  console.log(`API Secret: ${apiSecret ? "✅ SET" : "❌ MISSING"}`);
  console.log(`Sender Email: ${senderEmail || "❌ MISSING"}\n`);

  try {
    // 1. Get access token
    console.log("📋 Step 1: Getting access token...");
    const tokenResponse = await fetch("https://api.sendpulse.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: apiId!,
        client_secret: apiSecret!,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error("❌ Failed to get access token:", tokenData);
      process.exit(1);
    }

    const token = tokenData.access_token;
    console.log("✅ Access token obtained\n");

    // 2. Test sending email
    console.log("📋 Step 2: Testing email send...");
    const payload = {
      email: {
        subject: "",
        from: {
          name: "Ask Detectives",
          email: senderEmail,
        },
        to: [
          {
            email: "contact@askdetectives.com",
          },
        ],
        template: {
          id: 70578,
          variables: {
            userName: "Changappa A K",
            resetUrl: "http://localhost:5000/auth/reset-password?token=test",
            resetToken: "test",
            email: "contact@askdetectives.com",
            expiryTime: "24 hours",
            supportEmail: "support@askdetectives.com",
          },
        },
      },
    };

    console.log("Payload being sent:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("");

    const sendResponse = await fetch("https://api.sendpulse.com/mailing/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`Response Status: ${sendResponse.status} ${sendResponse.statusText}`);

    const responseData = await sendResponse.json();
    console.log("Response Data:");
    console.log(JSON.stringify(responseData, null, 2));

    if (sendResponse.ok && responseData.result?.status) {
      console.log("\n✅ EMAIL SENT SUCCESSFULLY!");
      console.log(`   Message ID: ${responseData.result.id}`);
    } else {
      console.log("\n❌ EMAIL SEND FAILED!");
      console.log("\nPossible issues:");
      console.log("1. Template ID 70578 doesn't exist in SendPulse");
      console.log("2. Sender email not verified in SendPulse");
      console.log("3. Template variables don't match expected format");
      console.log("\nNext steps:");
      console.log("1. Check SendPulse dashboard - confirm template 70578 exists");
      console.log("2. Verify sender email is configured and verified");
      console.log("3. Check template variables match in SendPulse");
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  }
}

testSendPulse();
