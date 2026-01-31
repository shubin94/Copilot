# SendPulse Email Integration - Quick Reference

## Import & Usage

```typescript
import { sendpulseEmail, EMAIL_TEMPLATES } from "./services/sendpulseEmail.ts";
```

## Send Email (Non-Blocking)

```typescript
sendpulseEmail.sendTransactionalEmail(
  "user@example.com",                    // recipient email
  EMAIL_TEMPLATES.WELCOME_USER,          // template ID (1001)
  {
    userName: "John Doe",                // dynamic variables
    email: "user@example.com",
    supportEmail: "support@askdetectives.com",
  }
).catch(err => console.error("[Email]", err)); // Always non-blocking
```

## Send Admin Email

```typescript
sendpulseEmail.sendAdminEmail(
  EMAIL_TEMPLATES.ADMIN_NEW_PAYMENT,
  {
    detectiveName: "Jane Doe",
    email: "jane@detectives.com",
    packageName: "Pro Plan",
    amount: "499",
    currency: "INR",
    supportEmail: "support@askdetectives.com",
  }
).catch(err => console.error("[Email]", err));
```

## All Template IDs

```typescript
EMAIL_TEMPLATES = {
  // User & Auth
  WELCOME_USER: 1001,
  EMAIL_VERIFICATION: 1002,
  PASSWORD_RESET: 1003,
  
  // Detective Signup
  DETECTIVE_APPLICATION_SUBMITTED: 1004,
  DETECTIVE_APPLICATION_APPROVED: 1005,
  DETECTIVE_APPLICATION_REJECTED: 1006,
  
  // Payments
  PAYMENT_SUCCESS: 2001,
  PAYMENT_FAILURE: 2002,
  SUBSCRIPTION_ACTIVATED: 2003,
  SUBSCRIPTION_EXPIRED: 2004,
  SUBSCRIPTION_RENEWING_SOON: 2005,
  DOWNGRADE_SCHEDULED: 2006,
  FREE_PLAN_APPLIED: 2007,
  BLUE_TICK_PURCHASE_SUCCESS: 2008,
  
  // Admin
  ADMIN_NEW_SIGNUP: 3001,
  ADMIN_NEW_PAYMENT: 3002,
  ADMIN_APPLICATION_RECEIVED: 3003,
  
  // Profile
  PROFILE_CLAIM_APPROVED: 4001,
  PROFILE_CLAIM_TEMPORARY_PASSWORD: 4002,
}
```

## Common Variables

```typescript
// User info
{
  userName: "John Doe",
  email: "john@example.com",
}

// Detective info
{
  detectiveName: "Jane Doe",
  email: "jane@detectives.com",
}

// Payment info
{
  packageName: "Pro Plan",
  billingCycle: "monthly",     // or "yearly"
  amount: "499",
  currency: "INR",
  subscriptionExpiryDate: "2026-01-28",
}

// Admin info
{
  supportEmail: "support@askdetectives.com",
  country: "US",
  businessType: "individual",
}

// Special
{
  temporaryPassword: "TempPass123!",
  rejectionReason: "Documents not verified",
  renewalDate: "2026-02-28",
}
```

## Environment Variables

```env
SENDPULSE_API_ID=c3cc2bb7dd824419487b8a2a39f32176
SENDPULSE_API_SECRET=720ea7face67a1a478648842dce87181
SENDPULSE_SENDER_EMAIL=contact@askdetectives.com
SENDPULSE_SENDER_NAME=Ask Detectives
SENDPULSE_ENABLED=true
ADMIN_EMAIL=admin@askdetectives.com
```

## Logging

All emails log with `[SendPulse]` prefix:

```
[SendPulse] Email sent successfully to user@example.com (Template: 1001)
[SendPulse] Failed to send email to user@example.com: Token request failed
[SendPulse] Retry successful for user@example.com
[SendPulse] DEV MODE - Email not sent: {...}
```

## Status Check

```typescript
const status = sendpulseEmail.getStatus();
console.log(status);
// {
//   enabled: true,
//   isProduction: true,
//   senderEmail: "contact@askdetectives.com",
//   senderName: "Ask Detectives"
// }
```

## Test Email (Development)

```bash
# In development, add this to test:
NODE_ENV=development SENDPULSE_ENABLED=true npm run dev

# Then trigger an email event:
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Pass123!","name":"Test"}'

# Check console for [SendPulse] logs
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Token request failed" | Verify API credentials in `.env` |
| "Template not found" | Verify template ID in SendPulse matches code |
| "Missing required fields" | Verify all variables passed to function |
| "Email sending disabled" | Set `SENDPULSE_ENABLED=true` in `.env` |
| No logs appearing | Check `NODE_ENV=production` and `SENDPULSE_ENABLED=true` |

## Patterns

### After User Creation
```typescript
const user = await storage.createUser(userData);

// Send welcome email
sendpulseEmail.sendTransactionalEmail(
  user.email,
  EMAIL_TEMPLATES.WELCOME_USER,
  { userName: user.name, email: user.email, supportEmail: "support@askdetectives.com" }
).catch(err => console.error("[Email]", err));
```

### After Payment Success
```typescript
await storage.markPaymentOrderPaid(order.id, { ...paymentData });

// Send to detective
sendpulseEmail.sendTransactionalEmail(
  detective.email,
  EMAIL_TEMPLATES.PAYMENT_SUCCESS,
  {
    detectiveName: detective.businessName,
    email: detective.email,
    packageName: pkg.name,
    billingCycle: "monthly",
    amount: String(order.amount),
    currency: "INR",
    subscriptionExpiryDate: expiryDate.toLocaleDateString(),
    supportEmail: "support@askdetectives.com",
  }
).catch(err => console.error("[Email]", err));

// Send to admin
sendpulseEmail.sendAdminEmail(
  EMAIL_TEMPLATES.ADMIN_NEW_PAYMENT,
  { /* similar variables */ }
).catch(err => console.error("[Email]", err));
```

## Development Tips

1. **Test without sending:** Set `SENDPULSE_ENABLED=false` (default in dev)
2. **Force send in dev:** Set `SENDPULSE_ENABLED=true`
3. **Monitor logs:** Watch console for `[SendPulse]` messages
4. **Check dashboard:** View emails in SendPulse "Sent" tab
5. **Verify templates:** Ensure template IDs match SendPulse
6. **Test variables:** Make sure all variables are passed correctly

## Production Checklist

- [ ] All templates created in SendPulse
- [ ] `.env` configured with credentials
- [ ] `NODE_ENV=production`
- [ ] `SENDPULSE_ENABLED=true`
- [ ] Test emails sent and received
- [ ] Delivery rate monitored
- [ ] Error logs checked
- [ ] Support email configured
- [ ] Unsubscribe links working
- [ ] Templates branded correctly

## Need Help?

1. **Technical details:** See EMAIL_INTEGRATION_GUIDE.md
2. **Template setup:** See SENDPULSE_TEMPLATE_SETUP.md
3. **Full overview:** See SENDPULSE_IMPLEMENTATION.md
4. **Source code:** server/services/sendpulseEmail.ts
5. **Integration examples:** server/routes.ts (search for `sendpulseEmail`)

---

**Last Updated:** January 28, 2026
**Status:** Production Ready ✅
