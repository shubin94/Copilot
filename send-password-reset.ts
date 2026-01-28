#!/usr/bin/env node
/**
 * Send Password Reset Email to Detective
 * Uses validated template variables
 */

import { db } from "./db/index.ts";
import { detectives, users, emailTemplates } from "./shared/schema.ts";
import { eq } from "drizzle-orm";
import { sendpulseEmail } from "./server/services/sendpulseEmail.ts";
import { validateTemplateVariables, getRequiredVariables } from "./lib/templateVariables.ts";

const detectiveId = "23dac06d-afc2-41f3-b941-eb48b0641d45";

async function sendPasswordResetEmail() {
  console.log("📧 Sending Password Reset Email");
  console.log("================================\n");

  try {
    // 1. Get detective details
    console.log("📋 Fetching detective details...");
    const detectiveRow = await db
      .select()
      .from(detectives)
      .where(eq(detectives.id, detectiveId))
      .limit(1)
      .then(r => r[0]);

    if (!detectiveRow) {
      console.error("❌ Detective not found!");
      process.exit(1);
    }

    // Get user info
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, detectiveRow.userId))
      .limit(1)
      .then(r => r[0]);

    if (!user) {
      console.error("❌ User not found for detective!");
      process.exit(1);
    }

    console.log(`✅ Found: ${detectiveRow.businessName}`);
    console.log(`   Email: ${user.email}\n`);

    // 2. Get PASSWORD_RESET template
    console.log("📋 Fetching PASSWORD_RESET template...");
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, "PASSWORD_RESET"))
      .limit(1)
      .then(r => r[0]);

    if (!template) {
      console.error("❌ PASSWORD_RESET template not found!");
      process.exit(1);
    }

    console.log(`✅ Template found: ${template.name}`);
    console.log(`   SendPulse ID: ${template.sendpulseTemplateId || "NOT SET"}\n`);

    if (!template.sendpulseTemplateId) {
      console.error("❌ SendPulse Template ID is not set!");
      process.exit(1);
    }

    // 3. Generate password reset token (mock for testing)
    const resetToken = "test-reset-token-" + Math.random().toString(36).substring(7);
    const resetUrl = `http://localhost:5000/auth/reset-password?token=${resetToken}`;

    // 4. Prepare email variables - MUST MATCH TEMPLATE EXACTLY
    // Template requires: userName, resetLink
    const emailVariables = {
      userName: detectiveRow.businessName,
      resetLink: resetUrl,
    };

    // Validate variables match template
    const validation = validateTemplateVariables("PASSWORD_RESET", emailVariables);
    if (!validation.valid) {
      console.error("❌ VARIABLE MISMATCH!");
      if (validation.missing.length > 0) {
        console.error(`   Missing: ${validation.missing.join(", ")}`);
      }
      if (validation.extra.length > 0) {
        console.error(`   Extra: ${validation.extra.join(", ")}`);
      }
      process.exit(1);
    }

    // Get only required variables
    const filteredVariables = getRequiredVariables("PASSWORD_RESET", emailVariables);

    console.log("📧 Sending email with variables:");
    console.log(JSON.stringify(filteredVariables, null, 2));
    console.log("");

    // 5. Send email via SendPulse
    console.log("📤 Sending via SendPulse...");
    const result = await sendpulseEmail.sendTransactionalEmail(
      user.email,
      template.sendpulseTemplateId,
      filteredVariables
    );

    console.log("\n📊 RESULT:\n");
    
    if (result.success) {
      console.log("✅ PASSWORD RESET EMAIL SENT SUCCESSFULLY!");
      console.log(`   To: ${user.email}`);
      console.log(`   Template ID: ${template.sendpulseTemplateId}`);
      console.log("\n🎉 Check inbox for the reset email");
    } else {
      console.log("❌ EMAIL SEND FAILED!");
      console.log(`   Error: ${result.error}`);
    }

  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

sendPasswordResetEmail();
