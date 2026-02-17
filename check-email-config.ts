#!/usr/bin/env npx tsx
/**
 * Email Configuration Status Check
 * 
 * Quick diagnostic to verify if email system is production-ready
 */

import { config } from "./server/config";
import { smtpEmailService } from "./server/services/smtpEmailService";
import { loadSecretsFromDatabase } from "./server/lib/secretsLoader";
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

  // 1. Check SMTP service status
  console.log("📤 SMTP Email Service Status:");
  console.log("-".repeat(60));
  // Ensure this diagnostic process loads secrets and templates from DB
  try {
    await loadSecretsFromDatabase();
  } catch (e) {
    // ignore - loadSecretsFromDatabase will warn in dev if DB unreachable
  }

  // Attempt to load templates into the SMTP service so status is accurate
  try {
    await smtpEmailService.reloadTemplates();
  } catch (e) {
    // ignore template load errors for diagnostic
  }

  const status = smtpEmailService.getStatus();
  console.log(`  Configured:    ${status.configured ? "✅ Yes" : "❌ No"}`);
  console.log(`  Templates:     ${status.templatesLoaded} loaded`);
  console.log(`  SMTP Host:     ${status.smtpHost || "NOT SET"}`);
  console.log(`  From Email:    ${status.fromEmail || "NOT SET"}`);
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

  // 4. Final Status (use SMTP readiness)
  console.log("=".repeat(60));
  console.log("🎯 FINAL STATUS:");
  console.log("=".repeat(60));

  const runtimeReady = status.configured && status.templatesLoaded > 0;
  if (runtimeReady) {
    console.log("✅ EMAIL SYSTEM IS READY FOR PRODUCTION");
    console.log("   Emails will be sent via SMTP using configured templates.");
  } else {
    console.log("🚫 EMAIL SYSTEM IS NOT READY FOR PRODUCTION");
    console.log("");
    if (!status.configured) {
      console.log("⚠️  SMTP not loaded by application (runtime):");
      console.log("   - Ensure the app loads SMTP secrets from the database at startup");
      console.log("   - Confirm `server/lib/secretsLoader.ts` is wired into startup");
      console.log("");
    }
    if (status.templatesLoaded === 0) {
      console.log("⚠️  No email templates loaded:");
      console.log("   - Seed `email_templates` table or ensure DB connection is available");
      console.log("");
    }
    console.log("🔧 QUICK FIX:");
    console.log("   1. Apply DB migrations (create tables)");
    console.log("   2. Ensure `app_secrets` contains smtp_host and smtp_from_email");
    console.log("   3. Restart the server so secretsLoader reads DB secrets");
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

  process.exit(runtimeReady ? 0 : 1);
}

checkEmailConfig().catch(error => {
  console.error("❌ Error checking email configuration:", error);
  process.exit(1);
});
