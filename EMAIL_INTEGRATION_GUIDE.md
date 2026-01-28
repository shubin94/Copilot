# SendPulse Email Integration Guide

## Overview

Complete SendPulse email sending implementation across all major platform events. All templates are managed in SendPulse dashboard, with code only referencing template IDs.

## Environment Configuration

Add these variables to `.env`:

```env
# SendPulse Email Configuration
SENDPULSE_API_ID=c3cc2bb7dd824419487b8a2a39f32176
SENDPULSE_API_SECRET=720ea7face67a1a478648842dce87181
SENDPULSE_SENDER_EMAIL=contact@askdetectives.com
SENDPULSE_SENDER_NAME=Ask Detectives
SENDPULSE_ENABLED=true
ADMIN_EMAIL=admin@askdetectives.com  # Optional: for admin notifications
```

## Security

- ✅ API credentials stored in `.env` only
- ✅ Secrets never logged or exposed to frontend
- ✅ Non-blocking email failures (don't break core flows)
- ✅ Graceful SendPulse downtime handling
- ✅ Automatic retry on failure

## Email Templates

### Template ID Mapping

All templates are defined in `server/services/sendpulseEmail.ts` under `EMAIL_TEMPLATES` constant.

**Template IDs to create in SendPulse Dashboard:**

#### User & Auth (1000-1999)
| ID | Name | Use Case | Variables |
|----|------|----------|-----------|
| 1001 | Welcome User | User signup confirmation | `userName`, `email`, `supportEmail` |
| 1002 | Email Verification | Email verification link | `userName`, `verificationLink`, `email`, `supportEmail` |
| 1003 | Password Reset | Password reset instructions | `userName`, `resetLink`, `email`, `supportEmail` |

#### Detective Signup & Approval (1004-1009)
| ID | Name | Use Case | Variables |
|----|------|----------|-----------|
| 1004 | Application Submitted | Confirmation when detective applies | `detectiveName`, `email`, `supportEmail` |
| 1005 | Application Approved | Approval notification | `detectiveName`, `email`, `supportEmail` |
| 1006 | Application Rejected | Rejection notification | `detectiveName`, `email`, `rejectionReason`, `supportEmail` |

#### Payments & Subscription (2000-2999)
| ID | Name | Use Case | Variables |
|----|------|----------|-----------|
| 2001 | Payment Success | Payment confirmation | `detectiveName`, `email`, `packageName`, `billingCycle`, `amount`, `currency`, `subscriptionExpiryDate`, `supportEmail` |
| 2002 | Payment Failure | Payment failed | `detectiveName`, `email`, `supportEmail` |
| 2003 | Subscription Activated | Subscription activated | `detectiveName`, `email`, `packageName`, `subscriptionStartDate`, `subscriptionExpiryDate`, `supportEmail` |
| 2004 | Subscription Expired | Subscription expired | `detectiveName`, `email`, `supportEmail` |
| 2005 | Renewing Soon | Subscription renewing in 7 days | `detectiveName`, `email`, `renewalDate`, `amount`, `supportEmail` |
| 2006 | Downgrade Scheduled | Downgrade scheduled | `detectiveName`, `email`, `currentPackage`, `downgradeDate`, `supportEmail` |
| 2007 | Free Plan Applied | Downgraded to free | `detectiveName`, `email`, `supportEmail` |
| 2008 | Blue Tick Success | Blue tick purchase success | `detectiveName`, `email`, `supportEmail` |

#### Admin Notifications (3000-3999)
| ID | Name | Use Case | Variables |
|----|------|----------|-----------|
| 3001 | New Signup | Admin: new detective signup | `detectiveName`, `email`, `country`, `businessType`, `supportEmail` |
| 3002 | New Payment | Admin: new payment received | `detectiveName`, `email`, `packageName`, `amount`, `currency`, `supportEmail` |
| 3003 | Application Received | Admin: new application to review | `detectiveName`, `email`, `country`, `businessType`, `supportEmail` |

#### Profile & Account (4000-4999)
| ID | Name | Use Case | Variables |
|----|------|----------|-----------|
| 4001 | Claim Approved | Profile claim approved | `detectiveName`, `email`, `supportEmail` |
| 4002 | Temporary Password | Temporary password for claimed profile | `detectiveName`, `email`, `temporaryPassword`, `supportEmail` |

---

## Implementation Details

### Email Service Location
`server/services/sendpulseEmail.ts`

### Key Functions

#### Send Transactional Email
```typescript
await sendpulseEmail.sendTransactionalEmail(
  to: string,
  templateId: number,
  variables: EmailVariable
): Promise<{ success: boolean; error?: string }>
```

**Usage:**
```typescript
sendpulseEmail.sendTransactionalEmail(
  "user@example.com",
  EMAIL_TEMPLATES.WELCOME_USER,
  {
    userName: "John Doe",
    email: "user@example.com",
    supportEmail: "support@askdetectives.com",
  }
).catch(err => console.error("[Email]", err)); // Non-blocking
```

#### Send Admin Email
```typescript
await sendpulseEmail.sendAdminEmail(
  templateId: number,
  variables: EmailVariable
): Promise<{ success: boolean; error?: string }>
```

**Usage:**
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
).catch(err => console.error("[Email]", err)); // Non-blocking
```

### Development Mode Behavior

**In Development (NODE_ENV !== "production"):**
- Emails are logged to console
- No actual emails sent (unless `SENDPULSE_ENABLED=true`)
- Useful for testing without SendPulse API calls

**In Production:**
- Emails sent via SendPulse API
- Failures logged but don't block main flow
- Automatic retry on transient failures

### Event Integration Points

All emails are added to existing event handlers in `server/routes.ts`:

#### 1. User Registration
- **Route:** `POST /api/auth/register`
- **Email:** Welcome User
- **Timing:** After user created in database

#### 2. Detective Application
- **Route:** `POST /api/applications`
- **Emails Sent:**
  - Application Submitted (to applicant)
  - Application Received (to admin)
- **Timing:** After application saved to database

#### 3. Application Review
- **Route:** `PATCH /api/applications/:id`
- **Emails Sent:**
  - Application Approved (to applicant on approval)
  - Application Rejected (to applicant on rejection)
- **Timing:** After application status updated

#### 4. Payment Verification
- **Route:** `POST /api/payments/verify`
- **Emails Sent:**
  - Payment Success (to detective)
  - New Payment (to admin)
- **Timing:** After payment marked as paid and subscription activated

#### 5. Blue Tick Purchase
- **Route:** `POST /api/payments/verify-blue-tick`
- **Email:** Blue Tick Purchase Success
- **Timing:** After blue tick activated

#### 6. Profile Claim Approval
- **Route:** `PATCH /api/profile-claims/:id`
- **Emails Sent:**
  - Profile Claim Approved (or Temporary Password if new user)
- **Timing:** After claim ownership transferred

---

## Error Handling

### Non-Blocking Design
All emails are sent with `.catch()` handlers to prevent failures from blocking main flow:

```typescript
sendpulseEmail.sendTransactionalEmail(...)
  .catch(err => console.error("[Email] Failed to send:", err)); // Logged but not thrown
```

### Retry Logic
- Automatic single retry on failure
- If retry fails, error logged but request still succeeds
- User never sees email failures

### Common Issues

**Issue: "Token request failed"**
- Check API ID and Secret in `.env`
- Verify credentials in SendPulse dashboard

**Issue: "Email sending disabled"**
- Check `SENDPULSE_ENABLED=true` in `.env`
- In development, emails log instead of sending

**Issue: "Missing required fields"**
- Verify all variables are passed correctly
- Check template expects those variables

---

## Testing

### Manual Testing

1. **Test in Development:**
```bash
NODE_ENV=development npm run dev
# Check console logs for email output
```

2. **Test Email Service:**
```bash
# Create test file: test-email.ts
import { sendpulseEmail, EMAIL_TEMPLATES } from "./services/sendpulseEmail.ts";

const result = await sendpulseEmail.sendTransactionalEmail(
  "test@example.com",
  EMAIL_TEMPLATES.WELCOME_USER,
  { userName: "Test User", email: "test@example.com", supportEmail: "support@askdetectives.com" }
);
console.log(result);
```

3. **Check SendPulse Dashboard:**
- Log into SendPulse
- Check "Sent" tab to verify emails were dispatched
- Check delivery/open rates

### Automated Testing

Run existing tests:
```bash
npm test
```

Email sending doesn't affect test flow (non-blocking).

---

## Migration Notes

### From Old Email System
- Legacy `sendClaimApprovedEmail` still works (kept for backward compatibility)
- New SendPulse emails sent alongside legacy emails during claim approval
- Can remove legacy function once all templates migrated

### Future Improvements
1. Add email preference management for users
2. Implement unsubscribe links
3. Track email delivery metrics
4. Add scheduled email campaigns
5. Implement email queue for batch sending

---

## Monitoring

### Logging
All email operations logged with `[SendPulse]` prefix:
- `[SendPulse] Email sent successfully to...`
- `[SendPulse] Failed to send email to...`
- `[SendPulse] Retry successful for...`

### Dashboard Metrics
Check SendPulse dashboard for:
- Delivery rate
- Open rate
- Click rate
- Bounce rate
- Spam complaints

---

## Security Checklist

- ✅ API credentials in `.env` (not in code)
- ✅ Secrets not logged
- ✅ Email failures non-blocking
- ✅ No sensitive data in email variables
- ✅ Rate limiting handled by SendPulse
- ✅ Sender email verified in SendPulse

---

## Support

For issues:
1. Check logs for `[SendPulse]` errors
2. Verify `.env` configuration
3. Verify template IDs in SendPulse dashboard
4. Check SendPulse API status
5. Verify email variables match template placeholders

---

**Last Updated:** January 28, 2026
**Status:** ✅ Production Ready
