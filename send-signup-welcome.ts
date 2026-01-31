#!/usr/bin/env node
/**
 * Send Signup Welcome Email to Detective
 */

import "dotenv/config";
import { db } from "./db/index.ts";
import { detectives, users, emailTemplates } from "./shared/schema.ts";
import { eq } from "drizzle-orm";
import { sendpulseEmail } from "./server/services/sendpulseEmail.ts";
import { validateTemplateVariables, getRequiredVariables } from "./lib/templateVariables.ts";

const detectiveId = "23dac06d-afc2-41f3-b941-eb48b0641d45";

async function sendSignupWelcome() {
  console.log("📧 Sending Signup Welcome Email");
  console.log("================================\n");

  try {
    // 1. Get detective and user
    console.log("📋 Fetching detective details...");
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

    if (!detectiveRow || !user) {
      console.error("❌ Detective or user not found!");
      process.exit(1);
    }

    console.log(`✅ Found: ${detectiveRow.businessName}`);
    console.log(`   Email: ${user.email}\n`);

    // 2. Get SIGNUP_WELCOME template
    console.log("📋 Fetching SIGNUP_WELCOME template...");
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, "SIGNUP_WELCOME"))
      .limit(1)
      .then(r => r[0]);

    if (!template) {
      console.error("❌ SIGNUP_WELCOME template not found!");
      process.exit(1);
    }

    console.log(`✅ Template: ${template.name}`);
    console.log(`   SendPulse ID: ${template.sendpulseTemplateId}\n`);

    if (!template.sendpulseTemplateId) {
      console.error("❌ SendPulse Template ID is not set!");
      process.exit(1);
    }

    // 3. Prepare variables for SIGNUP_WELCOME
    // Template requires: userName, loginUrl, supportEmail
    const emailVariables = {
      userName: detectiveRow.businessName,
      loginUrl: "http://localhost:5000/auth/login",
      supportEmail: "support@askdetectives.com",
    };

    // Validate variables match template
    console.log("📋 Validating variables...");
    const validation = validateTemplateVariables("SIGNUP_WELCOME", emailVariables);
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

    console.log(`✅ Variables validated\n`);

    // Get only required variables
    const filteredVariables = getRequiredVariables("SIGNUP_WELCOME", emailVariables);

    console.log("📧 Sending email with variables:");
    console.log(JSON.stringify(filteredVariables, null, 2));
    console.log("");

    // 4. Send email
    console.log("📤 Sending via SendPulse...");
    const result = await sendpulseEmail.sendTransactionalEmail(
      user.email,
      template.sendpulseTemplateId,
      filteredVariables
    );

    console.log("\n📊 RESULT:\n");
    
    if (result.success) {
      console.log("✅ SIGNUP WELCOME EMAIL SENT SUCCESSFULLY!");
      console.log(`   To: ${user.email}`);
      console.log(`   Template ID: ${template.sendpulseTemplateId}`);
      console.log("\n🎉 Check inbox at contact@askdetectives.com");
    } else {
      console.log("❌ EMAIL SEND FAILED!");
      console.log(`   Error: ${result.error}`);
    }

  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

sendSignupWelcome();
