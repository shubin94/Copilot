#!/usr/bin/env node
/**
 * Test email with correct SendPulse template ID
 */

import { sendpulseEmail } from "./server/services/sendpulseEmail.ts";

async function test() {
  console.log("🧪 Testing Email with Template ID 70568\n");

  const testEmail = "contact@askdetectives.com";
  const templateId = 70568;
  
  const mockVariables = {
    userName: "Changappa A K",
    detectiveName: "Changappa A K",
    email: testEmail,
    amount: "999",
    supportEmail: "support@askdetectives.com",
    loginUrl: "https://askdetectives.com/login",
    packageName: "Pro Plan",
    currency: "USD",
  };

  console.log("📧 Sending test email...");
  console.log(`   To: ${testEmail}`);
  console.log(`   Template ID: ${templateId}`);
  console.log(`   Template: Signup Welcome\n`);

  try {
    const result = await sendpulseEmail.sendTransactionalEmail(
      testEmail,
      templateId,
      mockVariables
    );

    console.log("\n📊 RESULT:\n");
    
    if (result.success) {
      console.log("✅ EMAIL SENT SUCCESSFULLY!");
      console.log(`   Check inbox: ${testEmail}`);
      console.log("\n🎉 The email system is working!");
    } else {
      console.log("❌ EMAIL SEND FAILED!");
      console.log(`   Error: ${result.error}`);
      console.log("\n⚠️  Need to fix the issue");
    }

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  }
}

test();
