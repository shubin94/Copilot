/**
 * Debug script to verify SendPulse payload structure and sender email
 */

import "dotenv/config";
import { sendpulseEmail } from "./server/services/sendpulseEmail";
import { db } from "./db";
import { emailTemplates, detectives, users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🔍 SendPulse Configuration Check");
  console.log("================================\n");

  // Get service status
  const status = sendpulseEmail.getStatus();
  console.log("📋 Service Status:");
  console.log(`  Enabled: ${status.enabled}`);
  console.log(`  Production: ${status.isProduction}`);
  console.log(`  Sender Email: ${status.senderEmail}`);
  console.log(`  Sender Name: ${status.senderName}`);
  console.log();

  // Verify environment variables
  console.log("🔐 Environment Variables:");
  console.log(`  SENDPULSE_API_ID: ${process.env.SENDPULSE_API_ID ? "✅ SET" : "❌ MISSING"}`);
  console.log(`  SENDPULSE_API_SECRET: ${process.env.SENDPULSE_API_SECRET ? "✅ SET" : "❌ MISSING"}`);
  console.log(`  SENDPULSE_SENDER_EMAIL: ${process.env.SENDPULSE_SENDER_EMAIL || "❌ MISSING"}`);
  console.log(`  SENDPULSE_SENDER_NAME: ${process.env.SENDPULSE_SENDER_NAME || "❌ MISSING"}`);
  console.log(`  SENDPULSE_ENABLED: ${process.env.SENDPULSE_ENABLED}`);
  console.log();

  // Get test detective
  const detective = await db
    .select()
    .from(detectives)
    .where(eq(detectives.id, "23dac06d-afc2-41f3-b941-eb48b0641d45"))
    .limit(1);

  if (detective.length === 0) {
    console.error("❌ Test detective not found");
    return;
  }

  const detectiveRow = detective[0];
  console.log("👤 Test Detective:");
  console.log(`  ID: ${detectiveRow.id}`);
  console.log(`  Business Name: ${detectiveRow.businessName}`);
  console.log(`  User Email (from detective): ${detectiveRow.email}`);
  
  // Try getting user email from users table
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, detectiveRow.userId))
    .limit(1);
  
  let userEmail = detectiveRow.email;
  if (user.length > 0) {
    userEmail = user[0].email;
    console.log(`  User Email (from users table): ${userEmail}`);
  }
  console.log();

  // Get template
  const template = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.key, "SIGNUP_WELCOME"))
    .limit(1);

  if (template.length === 0) {
    console.error("❌ SIGNUP_WELCOME template not found");
    return;
  }

  const templateRow = template[0];
  console.log("📧 Template:");
  console.log(`  Key: ${templateRow.key}`);
  console.log(`  SendPulse ID: ${templateRow.sendpulseTemplateId}`);
  console.log();

  // Prepare variables
  const emailVariables = {
    userName: detectiveRow.businessName,
    loginUrl: "http://localhost:5000/auth/login",
    supportEmail: "support@askdetectives.com",
  };

  console.log("📝 Email Variables:");
  console.log(JSON.stringify(emailVariables, null, 2));
  console.log();

  // Verify sender email matches exactly
  const configuredSender = process.env.SENDPULSE_SENDER_EMAIL;
  const expectedSender = "contact@askdetectives.com";
  const senderMatches = configuredSender === expectedSender;

  console.log("✅ Sender Email Verification:");
  console.log(`  Configured: "${configuredSender}"`);
  console.log(`  Expected: "${expectedSender}"`);
  console.log(`  Match: ${senderMatches ? "✅ YES" : "❌ NO"}`);
  console.log();

  // Show expected payload structure
  console.log("📤 Expected Payload Structure:");
  const examplePayload = {
    email: {
      subject: "Account Update",
      template: {
        id: templateRow.sendpulseTemplateId,
        variables: emailVariables,
      },
      from: {
        name: status.senderName,
        email: status.senderEmail,
      },
      to: [
        {
          email: userEmail,
          name: detectiveRow.businessName,
        },
      ],
    },
  };
  console.log(JSON.stringify(examplePayload, null, 2));
  console.log();

  // Test the email sending
  console.log("📤 Attempting to send test email...");
  const result = await sendpulseEmail.sendTransactionalEmail(
    userEmail,
    templateRow.sendpulseTemplateId,
    emailVariables
  );

  console.log();
  console.log("📊 Result:");
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    console.log();
    console.log("⚠️  Email send failed. Check the errors above.");
    console.log();
    console.log("💡 Troubleshooting:");
    console.log("  1. Verify 'contact@askdetectives.com' is verified in SendPulse SMTP > Sender Emails");
    console.log("  2. Check SMTP Status is Active in SendPulse SMTP > Settings");
    console.log("  3. Check SendPulse dashboard SMTP > History for detailed error messages");
  }
}

main().catch(console.error);
