# Email Template Testing System

## Overview

This system provides a comprehensive test suite to verify all email templates are configured correctly and sending properly.

**Endpoint**: `POST /api/admin/email-templates/test-all`
**Security**: Super Admin only
**Test Email**: `contact@askdetectives.com`

## What It Does

1. ✅ Fetches ALL active email templates from database
2. ✅ Sends a test email for EACH template using mock data
3. ✅ Checks for relative image URLs (warns if found)
4. ✅ Handles errors gracefully - continues if one template fails
5. ✅ Returns detailed report of success/failure per template

## Endpoint Behavior

### Request

```bash
POST /api/admin/email-templates/test-all
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

**Auth Required**: Super Admin (`user.role === "admin"`)

### Response Success (200 OK)

```json
{
  "total": 25,
  "success": 24,
  "failed": 1,
  "failedTemplates": [
    {
      "key": "BLUE_TICK_PURCHASE_SUCCESS",
      "name": "Blue Tick Purchase Success",
      "error": "SendPulse API error: Not Found - template ID not configured"
    }
  ],
  "testEmail": "contact@askdetectives.com",
  "timestamp": "2026-01-28T22:15:30.000Z"
}
```

### Response Errors

**401 Unauthorized**
```json
{ "error": "Not authenticated" }
```

**403 Forbidden**
```json
{ "error": "Access denied" }
```

**500 Server Error**
```json
{
  "error": "Failed to execute test email batch",
  "details": "Error message..."
}
```

## Mock Data Provided

All test emails use consistent mock data:

```javascript
{
  userName: "Ask Detectives",
  detectiveName: "Test Detective",
  loginEmail: "contact@askdetectives.com",
  tempPassword: "Temp@12345",
  packageName: "Pro Plan",
  billingCycle: "Monthly",
  amount: "999",
  currency: "USD",
  loginUrl: "https://askdetectives.com/login",
  claimLink: "https://askdetectives.com/claim-account?token=test",
  supportEmail: "support@askdetectives.com",
  // ... additional fallback variables
}
```

## How to Use

### Option 1: PowerShell (Windows)

```powershell
# With default credentials (admin@example.com / Admin@12345)
.\test-emails.ps1

# With custom admin credentials
.\test-emails.ps1 -AdminEmail "your-admin@askdetectives.com" -Password "YourPassword123"
```

### Option 2: cURL (All platforms)

```bash
# 1. Authenticate first
curl -c cookies.txt \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"email":"admin@example.com","password":"Admin@12345"}' \
  http://localhost:5000/api/auth/login

# 2. Test all templates
curl -b cookies.txt \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  http://localhost:5000/api/admin/email-templates/test-all | jq '.'
```

### Option 3: Node.js

```bash
node test-email-templates.js "admin@example.com" "Admin@12345"
```

### Option 4: Direct HTTP Client (Insomnia, Postman, etc.)

1. **Authenticate** with `/api/auth/login` endpoint
   - Email: admin credentials
   - Password: admin password
   - Store session cookie

2. **Call test endpoint**
   - Method: POST
   - URL: `http://localhost:5000/api/admin/email-templates/test-all`
   - Headers:
     - `Content-Type: application/json`
     - `X-Requested-With: XMLHttpRequest`
   - Cookie: From authentication

## Interpreting Results

### All Templates Passed ✅

```
Total templates: 25
Success: 25
Failed: 0
```

**Action**: Templates are ready for production use

### Some Templates Failed ⚠️

```
Total templates: 25
Success: 24
Failed: 1

Failed Templates:
1. BLUE_TICK_PURCHASE_SUCCESS (Blue Tick Purchase Success)
   Error: SendPulse API error: Not Found - template ID not configured
```

**Common Issues & Fixes**:

| Error | Cause | Fix |
|-------|-------|-----|
| "Not Found - template ID not configured" | SendPulse template ID missing | Set `sendpulseTemplateId` in database |
| "SendPulse API error: Invalid credentials" | API credentials invalid | Check `.env` SENDPULSE_API_ID/SECRET |
| "Template ID 0 not found" | ID is 0 or null | Verify template seeding in database |
| "Contains relative image URLs" | Images won't load | Update template body to use absolute URLs |

## What Gets Tested

For each template, the system:

1. ✅ Checks if `sendpulseTemplateId` is configured
2. ✅ Validates SendPulse API connection
3. ✅ Sends email with all mock variables
4. ✅ Scans for relative image URLs (`src="image.png"` instead of `src="https://...`)
5. ✅ Logs success/failure with timestamps

## Email Quality Checks (Manual)

After running the test, check `contact@askdetectives.com` inbox for:

### ✅ Images
- All images display correctly
- No broken image icons
- Images fully loaded (not truncated)

### ✅ Variables
- `${userName}` → "Ask Detectives"
- `${detectiveName}` → "Test Detective"
- `${amount}` → "999"
- All placeholders replaced with actual values
- No `undefined` or `[object Object]` in email

### ✅ Format
- No garbled text or encoding issues
- Layout looks professional
- Links are clickable
- Mobile-responsive

### ✅ Headers/Footer
- Sender: "Ask Detectives" <noreply@...>
- Subject: Matches template subject
- Unsubscribe link (if applicable)

## Security Notes

### ✅ What This Endpoint Is Safe For
- Testing templates in non-production
- Verifying SendPulse integration
- Checking variable rendering
- Validating template IDs

### ❌ What This Endpoint Does NOT Do
- Send emails to real users
- Trigger business events
- Create database records
- Consume SendPulse credits (test only)
- Change any configuration

### Auth Protection
- Requires Super Admin role
- Session-based (not API key)
- Logs all test runs

## Troubleshooting

### "Access denied" error
- Verify user role is "admin"
- Check session is valid (not expired)
- Ensure logged in to super admin account

### "Test email failed to send"
- Check `.env` SENDPULSE_ENABLED=true
- Verify SENDPULSE_API_ID and SECRET
- Check SendPulse account has credits
- Look for 404 errors (invalid template ID)

### No emails received
- Check contact@askdetectives.com inbox + spam folder
- Run test in production mode (NODE_ENV=production)
- Verify SendPulse account is active
- Check server logs for error messages

### Images not loading
- Check image URLs are absolute (https://...)
- Verify image hosting is accessible
- Check image URLs in template editor

### Variables not rendering
- Verify mock variables match template placeholders
- Check template syntax (e.g., `${userName}` not `{userName}`)
- Review template body in database

## Server Logs

When running test, server logs show:

```
[Admin] Starting test email batch for all templates...
[Admin] Sending test email for template: WELCOME_USER (ID: 1001)
[Admin] ✓ Test email sent: WELCOME_USER
[Admin] Sending test email for template: BLUE_TICK_PURCHASE_SUCCESS (ID: 2008)
[Admin] ✗ Failed to send test email: BLUE_TICK_PURCHASE_SUCCESS - SendPulse API error...
[Admin] Email test batch complete: 24 succeeded, 1 failed
```

**Warnings**:
- `contains relative image URLs` - images may not load in test email
- `has no SendPulse template ID` - skipping template (configure ID first)

## Production Deployment

### Before Going Live

1. ✅ Run test endpoint successfully
2. ✅ Verify test emails arrive at contact@askdetectives.com
3. ✅ Check images render correctly
4. ✅ Validate variables are populated
5. ✅ Review all 25+ email templates

### Disabling Test Endpoint

If you want to disable this endpoint in production:

```typescript
// In server/routes.ts, comment out the endpoint:
// app.post("/api/admin/email-templates/test-all", async (req, res) => { ... });
```

Or add environment check:

```typescript
if (process.env.NODE_ENV !== "production") {
  app.post("/api/admin/email-templates/test-all", ...);
}
```

## Technical Details

### File Location
- Route handler: `server/routes.ts` lines 3459-3520
- Email service: `server/services/sendpulseEmail.ts`
- Template service: `server/services/emailTemplateService.ts`
- Database schema: `shared/schema.ts` (emailTemplates table)

### Key Functions

| Function | Purpose |
|----------|---------|
| `getAllEmailTemplates()` | Fetch all templates from DB |
| `sendTransactionalEmail()` | Send email via SendPulse |
| `sanitizeVariables()` | Prepare variables for template |

### Error Handling

- Sends as many emails as possible (doesn't stop on first failure)
- Logs detailed error messages
- Returns complete report to client
- Non-blocking (email failures don't crash server)

## FAQ

**Q: Does this send emails to real users?**
A: No, it only sends to contact@askdetectives.com (configurable in code)

**Q: Will this trigger real business events?**
A: No, it's purely for testing templates - no database changes

**Q: Can I test individual templates?**
A: Currently tests all at once. To test one, modify mock data in code.

**Q: How often should I run this?**
A: When:
- Adding new email templates
- Updating template variables
- Changing SendPulse API credentials
- Before major deployments
- After migrating servers

**Q: Do I need production credentials?**
A: Only to test SendPulse integration. Mock data works in development.

## Related Endpoints

- `GET /api/admin/email-templates` - List all templates
- `GET /api/admin/email-templates/:key` - Get specific template
- `PUT /api/admin/email-templates/:key` - Update template
- `POST /api/admin/email-templates/:key/toggle` - Enable/disable template

---

**Version**: 1.0
**Created**: 2026-01-28
**Last Updated**: 2026-01-28
