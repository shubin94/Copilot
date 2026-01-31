import { resendEmail } from "./server/services/resendEmail.ts";

async function test() {
  console.log("[Test] Starting Resend email test...");
  console.log("[Test] Resend API Key configured:", !!process.env.RESEND_API_KEY);
  console.log("[Test] Status:", resendEmail.getStatus());

  // Test with template ID 70532
  const result = await resendEmail.sendTransactionalEmail(
    "contact@askdetectives.com",
    70532,
    {
      userName: "Test User",
      detectiveName: "Test Detective",
      amount: "999",
    }
  );

  console.log("[Test] Result:", result);
  
  if (result.success) {
    console.log("\n✅ EMAIL SENT SUCCESSFULLY!");
    console.log("Message ID:", result.messageId);
  } else {
    console.log("\n❌ EMAIL FAILED:");
    console.log("Error:", result.error);
  }

  process.exit(result.success ? 0 : 1);
}

test().catch((err) => {
  console.error("[Test] Fatal error:", err);
  process.exit(1);
});
