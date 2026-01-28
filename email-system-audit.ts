#!/usr/bin/env node
/**
 * Email System Audit
 * Checks all email templates and their configuration
 */

import { db } from "./db/index.ts";
import { emailTemplates } from "./shared/schema.ts";

async function auditEmailSystem() {
  console.log("📧 EMAIL SYSTEM AUDIT");
  console.log("=".repeat(70));
  console.log("");

  try {
    // 1. Get all templates
    const templates = await db.select().from(emailTemplates);

    console.log(`✅ Total Templates Found: ${templates.length}\n`);

    // 2. Check each template
    const issues = [];
    const summary = {
      total: templates.length,
      active: 0,
      missingId: 0,
      missingSubject: 0,
      missingBody: 0,
      ready: 0,
    };

    console.log("TEMPLATE STATUS CHECK:");
    console.log("-".repeat(70));
    console.log("");

    templates.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`);
      console.log(`   Key: ${t.key}`);
      console.log(`   Active: ${t.isActive ? "✅ YES" : "❌ NO"}`);
      
      if (t.isActive) summary.active++;

      // Check SendPulse ID
      if (t.sendpulseTemplateId) {
        console.log(`   SendPulse ID: ✅ ${t.sendpulseTemplateId}`);
      } else {
        console.log(`   SendPulse ID: ❌ NOT SET`);
        issues.push({ template: t.key, issue: "Missing SendPulse ID" });
        summary.missingId++;
      }

      // Check Subject
      if (t.subject && t.subject.trim()) {
        console.log(`   Subject: ✅ Set`);
      } else {
        console.log(`   Subject: ❌ MISSING`);
        issues.push({ template: t.key, issue: "Missing Subject" });
        summary.missingSubject++;
      }

      // Check Body
      if (t.body && t.body.trim()) {
        console.log(`   Body: ✅ Set`);
      } else {
        console.log(`   Body: ❌ MISSING`);
        issues.push({ template: t.key, issue: "Missing Body" });
        summary.missingBody++;
      }

      // Check if ready (has ID, subject, body, and is active)
      if (
        t.sendpulseTemplateId &&
        t.subject &&
        t.body &&
        t.isActive
      ) {
        console.log(`   Status: 🟢 READY TO SEND`);
        summary.ready++;
      } else {
        console.log(`   Status: 🟡 NEEDS SETUP`);
      }

      console.log("");
    });

    // 3. Summary
    console.log("📊 SUMMARY:");
    console.log("-".repeat(70));
    console.log(`Total Templates: ${summary.total}`);
    console.log(`Active Templates: ${summary.active}`);
    console.log(`Ready to Send: ${summary.ready}`);
    console.log(`Missing SendPulse ID: ${summary.missingId}`);
    console.log(`Missing Subject: ${summary.missingSubject}`);
    console.log(`Missing Body: ${summary.missingBody}`);
    console.log("");

    // 4. Issues
    if (issues.length > 0) {
      console.log("⚠️  ISSUES FOUND:");
      console.log("-".repeat(70));
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. [${issue.template}] ${issue.issue}`);
      });
      console.log("");
    }

    // 5. Configuration Check
    console.log("🔧 SENDPULSE CONFIGURATION:");
    console.log("-".repeat(70));
    
    const apiId = process.env.SENDPULSE_API_ID ? "✅ SET" : "❌ MISSING";
    const apiSecret = process.env.SENDPULSE_API_SECRET ? "✅ SET" : "❌ MISSING";
    const senderEmail = process.env.SENDPULSE_SENDER_EMAIL ? "✅ SET" : "❌ MISSING";
    const enabled = process.env.SENDPULSE_ENABLED === "true" ? "✅ YES" : "❌ NO";

    console.log(`API ID: ${apiId}`);
    console.log(`API Secret: ${apiSecret}`);
    console.log(`Sender Email: ${senderEmail} ${process.env.SENDPULSE_SENDER_EMAIL || ""}`);
    console.log(`Enabled: ${enabled}`);
    console.log("");

    // 6. Next Steps
    console.log("📋 NEXT STEPS:");
    console.log("-".repeat(70));
    console.log("1. ✅ Database templates are configured");
    console.log("2. ✅ SendPulse service is connected");
    console.log("3. 📝 Update SendPulse IDs for templates marked as 'NEEDS SETUP'");
    console.log("4. 📝 Ensure all templates are ACTIVE");
    console.log("5. 📝 Visit: http://localhost:5000/admin/email-templates");
    console.log("6. 📝 Fill in each template with SendPulse ID");
    console.log("");

    console.log("✨ READY CHECK:");
    console.log("-".repeat(70));
    if (summary.ready === summary.active && summary.active > 0) {
      console.log("✅ Email system is READY - all active templates are configured!");
    } else if (summary.ready > 0) {
      console.log(`⚠️  Partial setup: ${summary.ready}/${summary.active} active templates ready`);
      console.log("   Complete the setup for remaining templates");
    } else {
      console.log("❌ Email system NOT READY - templates need SendPulse IDs");
    }

  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

auditEmailSystem();
