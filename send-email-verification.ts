#!/usr/bin/env node
/**
 * Send Email Verification to Detective
 */

import { db } from "./db/index.ts";
import { detectives, users, emailTemplates } from "./shared/schema.ts";
import { eq } from "drizzle-orm";
import { sendpulseEmail } from "./server/services/sendpulseEmail.ts";
import { validateTemplateVariables, getRequiredVariables } from "./lib/templateVariables.ts";

const detectiveId = "23dac06d-afc2-41f3-b941-eb48b0641d45";

async function sendEmailVerification() {
  console.log("📧 Sending Email Verification");
  console.log("==============================\n");

  try {
    // 1. Get detective and user
    const detectiveRow = await db
      .select()
      .from(detectives)
      .where(eq(detectives.id, detectiveId))
      .limit(1)
      .then(r => r[0]);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, detectiveRow.userId))
      .limit(1)
      .then(r => r[0]);

    console.log(`✅ Found: ${detectiveRow.businessName}`);
    console.log(`   Email: ${user.email}\n`);

    // 2. Get EMAIL_VERIFICATION template
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, "EMAIL_VERIFICATION"))
      .limit(1)
      .then(r => r[0]);

    console.log(`✅ Template: ${template.name}`);
    console.log(`   SendPulse ID: ${template.sendpulseTemplateId}\n`);

    // 3. Generate verification token
    const verificationToken = "verify-" + Math.random().toString(36).substring(7);
    const verificationLink = `http://localhost:5000/auth/verify-email?token=${verificationToken}`;

    // 4. Prepare variables
    const emailVariables = {
      userName: detectiveRow.businessName,
      verificationLink: verificationLink,
    };

    // Validate
    const validation = validateTemplateVariables("EMAIL_VERIFICATION", emailVariables);
    if (!validation.valid) {
      console.error("❌ VARIABLE MISMATCH!");
      console.error(`   Missing: ${validation.missing.join(", ")}`);
      console.error(`   Extra: ${validation.extra.join(", ")}`);
      process.exit(1);
    }

    const filteredVariables = getRequiredVariables("EMAIL_VERIFICATION", emailVariables);

    console.log("📧 Sending email with variables:");
    console.log(JSON.stringify(filteredVariables, null, 2));
    console.log("");

    // 5. Send email
    console.log("📤 Sending via SendPulse...");
    const result = await sendpulseEmail.sendTransactionalEmail(
      user.email,
      template.sendpulseTemplateId,
      filteredVariables
    );

    console.log("\n📊 RESULT:\n");
    
    if (result.success) {
      console.log("✅ EMAIL VERIFICATION SENT SUCCESSFULLY!");
      console.log(`   To: ${user.email}`);
      console.log(`   Template ID: ${template.sendpulseTemplateId}`);
      console.log("\n🎉 Check inbox at contact@askdetectives.com");
    } else {
      console.log("❌ EMAIL SEND FAILED!");
      console.log(`   Error: ${result.error}`);
    }

  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

sendEmailVerification();
