/**
 * SENDPULSE SERVICE AUDIT REPORT
 * ==============================
 * 
 * Checking: Token Persistence, Error Logging, Variable Mapping
 */

// ✅ CHECKPOINT 1: TOKEN PERSISTENCE
// ===================================
// Location: Lines 71-96 in sendpulseEmail.ts
//
// CODE:
// private accessToken: string | null = null;
// private tokenExpiry: number = 0;
//
// private async getAccessToken(): Promise<string> {
//   // Return cached token if still valid
//   if (this.accessToken && Date.now() < this.tokenExpiry) {
//     return this.accessToken;
//   }
//   // ... fetch new token
//   this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
//   return this.accessToken;
// }
//
// ✅ STATUS: GOOD (In-Memory Caching)
// 
// What it does:
// - Caches token in memory (this.accessToken)
// - Checks if cached token is still valid before re-authenticating
// - Automatically refreshes when expired (with 60-second buffer)
//
// GOTCHA: Token is only cached in memory for the current process
// - If the app restarts, token is lost (but that's fine - re-authenticate)
// - If app runs for weeks, token auto-refreshes every ~1 hour
//
// ⚠️  NOT using file-based persistence like sendpulse.init("./token/")
// But that's OK because:
// 1. OAuth tokens are short-lived (~1 hour)
// 2. In-memory caching is fast and secure
// 3. No need for disk I/O on every email


// ✅ CHECKPOINT 2: ERROR LOGGING
// ===============================
// Location: Lines 160-180 and 190-210 in sendpulseEmail.ts
//
// PROBLEM AREAS:

// ❌ ERROR LOG #1 (Line 165-167):
if (!response.ok) {
  const errorData = await response.text();
  throw new Error(`SendPulse API error: ${response.statusText} - ${errorData}`);
}

// Issue: errorData might be empty string
// Better version:
if (!response.ok) {
  let errorData;
  try {
    errorData = await response.json();
  } catch {
    errorData = await response.text();
  }
  console.error(`[SendPulse] HTTP ${response.status} Error:`, {
    status: response.status,
    statusText: response.statusText,
    error: errorData,
    templateId: templateId,
    recipient: to
  });
  throw new Error(`SendPulse API error: ${response.statusText}`);
}

// ❌ ERROR LOG #2 (Line 172-175):
} else {
  console.error(
    `[SendPulse] API returned failure for ${to}:`,
    result
  );
  return { success: false, error: "API returned failure status" };
}

// Issue: Logs result object but NOT the specific template ID
// Better version:
} else {
  console.error(`[SendPulse] Email send failed:`, {
    templateId: templateId,
    recipient: to,
    apiResponse: result,
    timestamp: new Date().toISOString()
  });
  return { 
    success: false, 
    error: `Template ${templateId} send failed: ${JSON.stringify(result)}` 
  };
}

// ❌ ERROR LOG #3 (Line 182-186):
console.error(
  `[SendPulse] Failed to send email to ${to}:`,
  error instanceof Error ? error.message : String(error)
);

// Issue: Doesn't include templateId or retry count
// Better version:
console.error(`[SendPulse] Email send failed (attempt 1/2):`, {
  templateId: templateId,
  recipient: to,
  error: error instanceof Error ? error.message : String(error),
  timestamp: new Date().toISOString()
});


// ✅ CHECKPOINT 3: VARIABLE MAPPING
// ==================================
// Location: Lines 107-115 and 240-260 in sendpulseEmail.ts
//
// CODE:
async sendTransactionalEmail(
  to: string,
  templateId: number,
  variables: EmailVariable
): Promise<{ success: boolean; error?: string }> {
  
  const payload = {
    template_id: templateId,
    variables: this.sanitizeVariables(variables),  // ← Dynamic variables!
    from: { name: this.senderName, email: this.senderEmail },
    to: [{ email: to }],
  };
}

// ✅ STATUS: EXCELLENT
//
// What it does:
// - Accepts DYNAMIC variables object: EmailVariable (any key-value pairs)
// - Sanitizes all values to strings for template rendering
// - Passes through exactly what's provided
//
// SUPPORTS:
// ✅ EMAIL_VERIFICATION: { userName, verificationLink }
// ✅ PASSWORD_RESET: { userName, resetLink }
// ✅ SIGNUP_WELCOME: { userName, loginUrl, supportEmail }
// ✅ PAYMENT_SUCCESS: { amount, detectiveName, paymentDate, planName, receiptUrl, transactionId }
// ✅ All 16 templates with different variable sets
//
// SANITIZATION (Line 265-280):
private sanitizeVariables(variables: EmailVariable): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (value === null || value === undefined) {
      sanitized[key] = "";
    } else if (typeof value === "boolean") {
      sanitized[key] = value ? "true" : "false";
    } else {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
}

// ✅ STATUS: GOOD
// Handles null, undefined, boolean, number, string values correctly


// ============================================
// SUMMARY & RECOMMENDATIONS
// ============================================

// STRENGTHS:
// ✅ Token caching works well (in-memory with auto-refresh)
// ✅ Variable mapping is dynamic and flexible
// ✅ Supports all 16 templates with different variable structures
// ✅ Retry logic on failure

// IMPROVEMENTS NEEDED:

// 1. ENHANCE ERROR LOGGING
//    - Add templateId to all error messages
//    - Log full JSON response (not just message)
//    - Add attempt number for retries
//    - Add timestamp for debugging

// 2. VALIDATE REQUIRED VARIABLES
//    Create a validator that checks:
//    - EMAIL_VERIFICATION requires: userName, verificationLink
//    - PASSWORD_RESET requires: userName, resetLink
//    - SIGNUP_WELCOME requires: userName, loginUrl, supportEmail
//    - etc.

// 3. LOG SUCCESS RATE
//    Track metrics:
//    - Total emails sent
//    - Success count
//    - Failure count
//    - Most common errors
//    - Slowest templates

console.log(`
📊 SENDPULSE SERVICE AUDIT RESULTS
====================================

✅ Token Persistence: GOOD
   - In-memory caching with auto-refresh
   - No "Too Many Requests" errors expected

✅ Variable Mapping: EXCELLENT  
   - Dynamic variables for all template types
   - Handles 16+ different templates
   - Sanitization is robust

⚠️  Error Logging: NEEDS IMPROVEMENT
   - Missing templateId in some logs
   - Should log full response objects
   - Should track retry attempts

NEXT ACTIONS:
1. Update error logging to include templateId
2. Add variable validation per template
3. Run test suite with all 16 templates
4. Monitor SendPulse dashboard for error patterns
`);
