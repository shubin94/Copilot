import { resendEmail } from "./server/services/resendEmail.ts";
import https from "https";

// Allow self-signed certificates in development
const agent = new https.Agent({
  rejectUnauthorized: false,
});

// Monkey patch fetch to use the agent
const originalFetch = global.fetch;
global.fetch = ((url: string | Request, options?: any) => {
  if (typeof url === "string" && url.startsWith("https")) {
    options = { ...options, agent };
  }
  return originalFetch(url, options);
}) as any;

async function test() {
  console.log("[Test] Starting Resend email test...");
  console.log("[Test] Resend API Key configured:", !!process.env.RESEND_API_KEY);
  console.log("[Test] Status:", resendEmail.getStatus());

  // Test with template ID 70532 (the one we were trying)
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
}

test().catch(console.error);
