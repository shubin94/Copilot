#!/usr/bin/env npx tsx
/**
 * Test SMTP Email Service
 * 
 * Verifies that the new SMTP-based email service works correctly
 */

import { smtpEmailService, EMAIL_TEMPLATE_KEYS } from "./server/services/smtpEmailService";

const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

async function testSMTPEmail() {
  console.log("🧪 Testing SMTP Email Service");
  console.log("=" .repeat(60));
  console.log("");

  // Check status
  console.log("📊 Service Status:");
  const status = smtpEmailService.getStatus();
  console.log(`  Configured: ${status.configured ? "✅" : "❌"}`);
  console.log(`  SMTP Host: ${status.smtpHost || "NOT SET"}`);
  console.log(`  From Email: ${status.fromEmail || "NOT SET"}`);
  console.log(`  Templates Loaded: ${status.templatesLoaded}`);
  console.log("");

  if (!status.configured) {
    console.log("⚠️  SMTP not configured. Email will be logged to console only.");
    console.log("");
  }

  // Test welcome email
  console.log("📧 Test 1: Sending Welcome Email");
  console.log("-".repeat(60));
  
  const result1 = await smtpEmailService.sendTransactionalEmail(
    TEST_EMAIL,
    EMAIL_TEMPLATE_KEYS.WELCOME_USER,
    {
      userName: "Test User",
      email: TEST_EMAIL,
      loginUrl: "http://localhost:5000/login",
      supportEmail: "support@askdetectives.com",
    }
  );

  if (result1.success) {
    console.log("✅ Welcome email sent successfully");
  } else {
    console.log(`❌ Failed: ${result1.error}`);
  }
  console.log("");

  // Test password reset email
  console.log("📧 Test 2: Sending Password Reset Email");
  console.log("-".repeat(60));
  
  const result2 = await smtpEmailService.sendTransactionalEmail(
    TEST_EMAIL,
    EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
    {
      userName: "Test User",
      resetLink: "http://localhost:5000/reset-password?token=test123",
    }
  );

  if (result2.success) {
    console.log("✅ Password reset email sent successfully");
  } else {
    console.log(`❌ Failed: ${result2.error}`);
  }
  console.log("");

  // Test payment success email
  console.log("📧 Test 3: Sending Payment Success Email");
  console.log("-".repeat(60));
  
  const result3 = await smtpEmailService.sendTransactionalEmail(
    TEST_EMAIL,
    EMAIL_TEMPLATE_KEYS.PAYMENT_SUCCESS,
    {
      detectiveName: "Test Detective Agency",
      email: TEST_EMAIL,
      packageName: "Professional Plan",
      billingCycle: "monthly",
      amount: "2999",
      currency: "INR",
      subscriptionExpiryDate: "March 12, 2026",
      supportEmail: "support@askdetectives.com",
    }
  );

  if (result3.success) {
    console.log("✅ Payment success email sent successfully");
  } else {
    console.log(`❌ Failed: ${result3.error}`);
  }
  console.log("");

  // Summary
  console.log("=".repeat(60));
  console.log("🎯 Test Summary");
  console.log("=".repeat(60));
  
  const allSuccess = result1.success && result2.success && result3.success;
  
  if (allSuccess) {
    console.log("✅ ALL TESTS PASSED");
    console.log("");
    if (status.configured) {
      console.log(`📬 Check ${TEST_EMAIL} for the test emails`);
    } else {
      console.log("⚠️  SMTP not configured - emails were logged above");
    }
  } else {
    console.log("❌ SOME TESTS FAILED");
  }
  console.log("");

  process.exit(allSuccess ? 0 : 1);
}

testSMTPEmail().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
