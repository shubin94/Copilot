#!/usr/bin/env npx tsx
/**
 * Email Configuration Status Check
 * 
 * Quick diagnostic to verify if email system is production-ready
 */

import { config } from "./server/config";
import { sendpulseEmail } from "./server/services/sendpulseEmail";
import { db } from "./db/index";
import { appSecrets } from "./shared/schema";
import { inArray } from "drizzle-orm";

const EMAIL_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_pass",
  "smtp_from_email",
];

async function checkEmailConfig() {
  console.log("🔍 EMAIL CONFIGURATION STATUS CHECK");
  console.log("=" .repeat(60));
  console.log("");

  // 1. Check SendPulse API Configuration (from environment)
  console.log("📧 SendPulse API Configuration (Environment Variables):");
  console.log("-".repeat(60));
  
  const hasApiId = !!process.env.SENDPULSE_API_ID && process.env.SENDPULSE_API_ID !== "your-api-id";
  const hasApiSecret = !!process.env.SENDPULSE_API_SECRET && process.env.SENDPULSE_API_SECRET !== "your-api-secret";
  const isEnabled = process.env.SENDPULSE_ENABLED === "true";

  console.log(`  SENDPULSE_API_ID:      ${hasApiId ? "✅ Configured" : "❌ NOT SET"}`);
  console.log(`  SENDPULSE_API_SECRET:  ${hasApiSecret ? "✅ Configured" : "❌ NOT SET"}`);
  console.log(`  SENDPULSE_ENABLED:     ${isEnabled ? "✅ true" : "❌ false"}`);
  console.log(`  SENDPULSE_SENDER_EMAIL: ${process.env.SENDPULSE_SENDER_EMAIL || "❌ NOT SET"}`);
  console.log(`  SENDPULSE_SENDER_NAME:  ${process.env.SENDPULSE_SENDER_NAME || "❌ NOT SET"}`);
  console.log("");

  const sendPulseConfigured = hasApiId && hasApiSecret && isEnabled;
  if (sendPulseConfigured) {
    console.log("✅ SendPulse API is CONFIGURED and ENABLED");
  } else {
    console.log("🚫 SendPulse API is NOT CONFIGURED");
    console.log("   ⚠️  All emails will be MOCKED (not actually sent)!");
  }
  console.log("");

  // 2. Check SendPulse Service Status
  console.log("📤 SendPulse Service Status:");
  console.log("-".repeat(60));
  const status = sendpulseEmail.getStatus();
  console.log(`  Enabled:       ${status.enabled ? "✅ Yes" : "❌ No"}`);
  console.log(`  Is Production: ${status.isProduction ? "✅ Yes" : "⚠️  No (dev mode)"}`);
  console.log(`  Sender Email:  ${status.senderEmail}`);
  console.log(`  Sender Name:   ${status.senderName}`);
  console.log("");

  // 3. Check SMTP Configuration (from database)
  console.log("🔧 SMTP Configuration (Database - app_secrets):");
  console.log("-".repeat(60));
  
  const smtpSecrets = await db
    .select()
    .from(appSecrets)
    .where(inArray(appSecrets.key, EMAIL_KEYS));

  const smtpConfig: Record<string, boolean> = {};
  for (const key of EMAIL_KEYS) {
    const found = smtpSecrets.find(s => s.key === key);
    smtpConfig[key] = !!found && !!found.value && found.value !== "";
    console.log(`  ${key.padEnd(20)} ${smtpConfig[key] ? "✅ YES" : "❌ NO"}`);
  }
  console.log("");

  const smtpConfigured = smtpConfig['smtp_host'] && smtpConfig['smtp_from_email'];
  if (smtpConfigured) {
    console.log("✅ SMTP is configured in database");
    console.log("   ⚠️  BUT: Application uses SendPulse API, not direct SMTP!");
  } else {
    console.log("❌ SMTP is NOT fully configured");
  }
  console.log("");

  // 4. Final Status
  console.log("=".repeat(60));
  console.log("🎯 FINAL STATUS:");
  console.log("=".repeat(60));

  if (sendPulseConfigured) {
    console.log("✅ EMAIL SYSTEM IS READY");
    console.log("   Emails will be sent via SendPulse API");
  } else {
    console.log("🚫 EMAIL SYSTEM IS NOT READY FOR PRODUCTION");
    console.log("");
    console.log("⚠️  CRITICAL ISSUE:");
    console.log("   - Application code uses sendpulseEmail.sendTransactionalEmail()");
    console.log("   - This requires SendPulse API credentials");
    console.log("   - Credentials are NOT configured in environment");
    console.log("   - Result: NO EMAILS WILL BE SENT (mocked only)");
    console.log("");
    console.log("🔧 TO FIX:");
    console.log("   1. Get your SendPulse API credentials:");
    console.log("      → Log into SendPulse dashboard");
    console.log("      → Go to Settings > API");
    console.log("      → Copy API ID and API Secret");
    console.log("");
    console.log("   2. Add to your .env file:");
    console.log("      SENDPULSE_API_ID=your-api-id-here");
    console.log("      SENDPULSE_API_SECRET=your-api-secret-here");
    console.log("      SENDPULSE_SENDER_EMAIL=contact@askdetectives.com");
    console.log("      SENDPULSE_SENDER_NAME=Ask Detectives");
    console.log("      SENDPULSE_ENABLED=true");
    console.log("");
    console.log("   3. Restart the server");
    console.log("   4. Run this script again to verify");
  }
  console.log("");

  // 5. Additional Warnings
  if (!process.env.ADMIN_EMAIL) {
    console.log("⚠️  WARNING: ADMIN_EMAIL not configured");
    console.log("   Admin notification emails will fail");
    console.log("   Set: ADMIN_EMAIL=admin@askdetectives.com");
    console.log("");
  }

  process.exit(sendPulseConfigured ? 0 : 1);
}

checkEmailConfig().catch(error => {
  console.error("❌ Error checking email configuration:", error);
  process.exit(1);
});
