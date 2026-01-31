#!/usr/bin/env node
/**
 * Direct Email Send Test
 * Tries to send a single test email and captures the error
 */

import { db } from "./db/index.ts";
import { emailTemplates } from "./shared/schema.ts";
import { sendpulseEmail } from "./server/services/sendpulseEmail.ts";

async function test() {
  console.log("🧪 Testing Email Send\n");

  try {
    // 1. Get first template with SendPulse ID
    console.log("1️⃣  Fetching email templates...");
    const templates = await db.select().from(emailTemplates);
    console.log(`   Found ${templates.length} templates\n`);

    const templateWithId = templates.find(t => t.sendpulseTemplateId);
    
    if (!templateWithId) {
      console.error("❌ No templates have SendPulse IDs configured!");
      console.error("   Templates found:", templates.map(t => ({
        key: t.key,
        name: t.name,
        sendpulseTemplateId: t.sendpulseTemplateId
      })));
      process.exit(1);
    }

    console.log(`✅ Using template: ${templateWithId.key}`);
    console.log(`   Name: ${templateWithId.name}`);
    console.log(`   SendPulse ID: ${templateWithId.sendpulseTemplateId}\n`);

    // 2. Try to send email
    console.log("2️⃣  Attempting to send test email...\n");
    
    const testEmail = "contact@askdetectives.com";
    const mockVariables = {
      userName: "Test User",
      detectiveName: "Changappa A K",
      email: testEmail,
      amount: "999",
      supportEmail: "support@askdetectives.com",
    };

    console.log("📧 Email Details:");
    console.log(`   To: ${testEmail}`);
    console.log(`   Template: ${templateWithId.sendpulseTemplateId}`);
    console.log(`   Variables: ${JSON.stringify(mockVariables)}\n`);

    const result = await sendpulseEmail.sendTransactionalEmail(
      testEmail,
      templateWithId.sendpulseTemplateId,
      mockVariables
    );

    // 3. Show result
    console.log("📊 RESULT:\n");
    
    if (result.success) {
      console.log("✅ EMAIL SENT SUCCESSFULLY!");
      console.log(`   Check inbox: ${testEmail}`);
    } else {
      console.log("❌ EMAIL SEND FAILED!");
      console.log(`   Error: ${result.error}`);
    }

    process.exit(0);

  } catch (error) {
    console.error("❌ FATAL ERROR:\n");
    console.error(error);
    process.exit(1);
  }
}

test();
