#!/usr/bin/env node
/**
 * Test SendPulse with different API approaches
 */

async function test() {
  const apiId = "c3cc2bb7dd824419487b8a2a39f32176";
  const apiSecret = "720ea7face67a1a478648842dce87181";

  console.log("🔑 Testing SendPulse API - Multiple Approaches\n");

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

    const tokenData = await tokenRes.json();
    console.log("✅ Access token obtained\n");

    // Test 1: Template ID as number
    console.log("TEST 1: Template ID as NUMBER (70532)");
    console.log("────────────────────────────────────\n");
    
    let payload = {
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
          },
        },
      },
    };

    let sendRes = await fetch("https://api.sendpulse.com/mailing/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`Status: ${sendRes.status}`);
    let result = await sendRes.text();
    console.log(`Response: ${result}\n`);

    if (sendRes.status === 200) {
      console.log("✅ SUCCESS with template ID as number!\n");
      return;
    }

    // Test 2: Template ID as string
    console.log("TEST 2: Template ID as STRING ('70532')");
    console.log("────────────────────────────────────\n");
    
    payload.email.template.id = "70532";

    sendRes = await fetch("https://api.sendpulse.com/mailing/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`Status: ${sendRes.status}`);
    result = await sendRes.text();
    console.log(`Response: ${result}\n`);

    if (sendRes.status === 200) {
      console.log("✅ SUCCESS with template ID as string!\n");
      return;
    }

    // Test 3: Different endpoint - smtp/emails
    console.log("TEST 3: Using SMTP endpoint");
    console.log("────────────────────────────────────\n");
    
    const smtpPayload = {
      email: {
        html: "",
        text: "",
        subject: "Test Email",
        from: {
          name: "Ask Detectives",
          email: "contact@askdetectives.com",
        },
        to: [
          {
            name: "Test User",
            email: "contact@askdetectives.com",
          },
        ],
        template: {
          id: 70532,
          variables: {
            userName: "Test User",
          },
        },
      },
    };

    sendRes = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(smtpPayload),
    });

    console.log(`Status: ${sendRes.status}`);
    result = await sendRes.text();
    console.log(`Response: ${result}\n`);

    if (sendRes.status === 200) {
      console.log("✅ SUCCESS with SMTP endpoint!\n");
      return;
    }

    console.log("❌ All tests failed");
    console.log("\n💡 Next steps:");
    console.log("  1. Check if template 70532 is published in SendPulse");
    console.log("  2. Verify the template is a 'Transactional' template");
    console.log("  3. Check SendPulse account permissions");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

test();
