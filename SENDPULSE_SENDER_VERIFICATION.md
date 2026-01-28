# SendPulse Sender Email Verification

## Current Issue
HTTP 422 Error: **"Sender is not valid"**

This error occurs even though the payload structure is now correct (previously: "Argument email missing").

## Root Cause
SendPulse requires the sender email address to be verified in their SMTP settings before it can send emails.

## Solution: Verify Sender Email in SendPulse Dashboard

### Steps to Fix:

1. **Log in to SendPulse Dashboard**
   - Go to https://app.sendpulse.com

2. **Navigate to SMTP Settings**
   - Sidebar: **SMTP** → **Sender Emails**
   - Look for: `contact@askdetectives.com`

3. **Verify or Add the Sender Email**
   - If `contact@askdetectives.com` is listed with status ✅ **Verified**:
     - Check "SMTP > History" for recent errors
     - The email should work after verification
   
   - If `contact@askdetectives.com` is missing or shows ❌ **Not Verified**:
     - Click "Add Sender Email"
     - Enter: `contact@askdetectives.com`
     - SendPulse will send a verification email to that address
     - Click the verification link in the email
     - Wait for status to change to ✅ **Verified**

4. **Check SMTP Status**
   - Go to **SMTP** → **Settings**
   - Ensure **SMTP Status** is set to **Active**
   - Some accounts require filling out a "test application form" before SMTP is enabled

5. **Retry Email Test**
   - Once verified, run: `npx tsx send-signup-welcome.ts`
   - Should now send successfully with HTTP 200 response

## Configuration in This Project

**Sender Email:** `contact@askdetectives.com`
**Sender Name:** `Ask Detectives`

Location: `server/config.ts`
```typescript
sendpulse: {
  senderEmail: "contact@askdetectives.com",
  senderName: "Ask Detectives",
  ...
}
```

## Testing Verification

After sender is verified, you should see:
```
✅ EMAIL SEND SUCCESSFUL!
   Recipient: contact@askdetectives.com
```

And the email will arrive in the inbox within a few minutes.

## Additional Checks

If email still doesn't arrive after sender verification:

1. **Check SendPulse History**
   - SMTP → History
   - Look for recent sends to `contact@askdetectives.com`
   - Check delivery status and bounce messages

2. **Check Spam Folder**
   - Email might be in spam/junk folder
   - Mark as "Not Spam" to improve delivery

3. **Verify SPF/DKIM Records** (if using custom domain)
   - SendPulse → SMTP → Domain Verification
   - Add SPF record: `v=spf1 sendpulse.net ~all`
   - Add DKIM record: Follow SendPulse's instructions

4. **Test with Different Recipient**
   - Try sending to a different email address
   - Helps isolate if issue is with `contact@askdetectives.com` specifically
