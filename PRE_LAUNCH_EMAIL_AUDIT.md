# 🚨 PRE-LAUNCH EMAIL AUDIT REPORT
**Status**: **CRITICAL ISSUES FOUND - NOT PRODUCTION READY**  
**Date**: February 12, 2026  
**Auditor**: GitHub Copilot

---

## ⚠️ CRITICAL ISSUES (MUST FIX BEFORE LAUNCH)

### 1. **EMAIL SERVICE MISCONFIGURATION - NO EMAILS BEING SENT** 🚫
**Severity**: 🔴 **CRITICAL - BLOCKING**

**Problem**:
- All email triggers in `server/routes.ts` use `sendpulseEmail.sendTransactionalEmail()`
- This service requires SendPulse API credentials (`SENDPULSE_API_ID`, `SENDPULSE_API_SECRET`)
- These credentials are **NOT CONFIGURED** (commented out in `.env`)
- When not configured, the service returns `{ success: true, mocked: true }` **WITHOUT SENDING ANY EMAILS**
- Users will NOT receive:
  - Welcome emails after signup ❌
  - Payment confirmation emails ❌
  - Password reset emails ❌
  - Detective application notifications ❌
  - ANY email notifications ❌

**Current State**:
```env
# .env (all commented out - NOT ACTIVE)
# SENDPULSE_API_ID=your-api-id
# SENDPULSE_API_SECRET=your-api-secret
# SENDPULSE_SENDER_EMAIL=noreply@example.com
# SENDPULSE_SENDER_NAME=Your App Name
# SENDPULSE_ENABLED=false
```

**Evidence from Code**:
```typescript
// server/services/sendpulseEmail.ts:130-137
if (!this.enabled) {
  console.log("[SendPulse] ⚠️ SendPulse is disabled in config. Skipping email.");
  return { success: true, mocked: true }; // ← NO EMAIL SENT!
}
```

**Fix Required**:
Choose ONE of the following options:

**Option A: Enable SendPulse API** (Recommended if using SendPulse templates)
1. Uncomment SendPulse environment variables in `.env`
2. Add real credentials:
   ```env
   SENDPULSE_API_ID=your-real-api-id
   SENDPULSE_API_SECRET=your-real-api-secret
   SENDPULSE_SENDER_EMAIL=contact@askdetectives.com
   SENDPULSE_SENDER_NAME=Ask Detectives
   SENDPULSE_ENABLED=true
   ```
3. Verify all template IDs in `EMAIL_TEMPLATES` exist in SendPulse dashboard
4. Test each email trigger before launch

**Option B: Switch to Direct SMTP**
1. Update all `sendpulseEmail.sendTransactionalEmail()` calls to use direct SMTP
2. Create wrapper function using `nodemailer` with database SMTP config
3. Replace templated emails with HTML email templates
4. This requires significant code refactoring

---

### 2. **FORGOT PASSWORD FLOW MISSING** 🔐
**Severity**: 🔴 **CRITICAL - USER EXPERIENCE**

**Problem**:
- Users have NO WAY to reset forgotten passwords
- "Forgot password?" button shows toast: "Not available yet"
- Password reset email template (ID: 1003) exists but is never triggered
- NO `/api/auth/forgot-password` endpoint
- NO `/api/auth/reset-password` endpoint

**Current State**:
```tsx
// client/src/pages/auth/login.tsx:220-229
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    toast({ title: "Not available yet", description: "This feature is not available yet." });
  }}
>
  Forgot password?
</button>
```

**Impact**:
- Users who forget passwords cannot access their accounts
- Only workaround: Admin manual password reset (not acceptable for production)
- Poor user experience, will lead to support tickets

**Fix Required**:
Implement complete forgot password flow:

1. **Create `/api/auth/forgot-password` POST endpoint**:
   - Accept email address
   - Generate secure reset token (crypto.randomBytes)
   - Store token in database with expiry (1 hour)
   - Send PASSWORD_RESET email with reset link
   - Return success (don't reveal if email exists)

2. **Create `/api/auth/reset-password` POST endpoint**:
   - Accept token + new password
   - Validate token exists and not expired
   - Hash new password with bcrypt
   - Update user password
   - Invalidate token
   - Send confirmation email

3. **Create frontend reset password page** (`/reset-password?token=xxx`)

4. **Update login page**: Enable "Forgot password?" button with link to forgot password flow

**Estimated Effort**: 4-6 hours

---

### 3. **EMAIL VERIFICATION NOT IMPLEMENTED** 📧
**Severity**: 🟡 **MEDIUM - SECURITY & DELIVERABILITY**

**Problem**:
- Email verification template (ID: 1002) exists but is never used
- No verification flow in registration
- Unverified emails can fully access the platform
- May impact email deliverability (spam rates)

**Impact**:
- Cannot verify user email ownership
- Fake/typo emails pollute database
- May affect sender reputation
- Security: No proof users control their email

**Fix Required** (Optional but Recommended):
1. Add `email_verified` boolean to users table
2. Generate verification token on registration
3. Send EMAIL_VERIFICATION email with link
4. Create `/api/auth/verify-email?token=xxx` endpoint
5. Require verification for sensitive actions (or add banner)

**Estimated Effort**: 3-4 hours

---

## ✅ WORKING EMAIL TRIGGERS

### Registration & Welcome Email ✅
- **Endpoint**: `POST /api/auth/register`
- **Template**: `WELCOME_USER` (1001)
- **Trigger**: New user signup
- **Variables**: `userName`, `email`, `supportEmail`
- **Status**: Implemented (but not sending due to Issue #1)

### Payment Confirmation Email ✅
- **Endpoint**: `POST /api/razorpay/verify`
- **Template**: `PAYMENT_SUCCESS` (2001)
- **Trigger**: Successful payment verification
- **Variables**: `detectiveName`, `email`, `packageName`, `billingCycle`, `amount`, `currency`, `subscriptionExpiryDate`, `supportEmail`
- **Admin Notification**: `ADMIN_NEW_PAYMENT` (3002)
- **Status**: Implemented (but not sending due to Issue #1)

### Blue Tick Purchase Email ✅
- **Endpoint**: `POST /api/razorpay/verify-blue-tick`
- **Template**: `BLUE_TICK_PURCHASE_SUCCESS` (2008)
- **Trigger**: Blue tick addon payment success
- **Variables**: `detectiveName`, `email`, `amount`, `currency`, `supportEmail`
- **Status**: Implemented (but not sending due to Issue #1)

### Detective Application Emails ✅
- **Submission**: `DETECTIVE_APPLICATION_SUBMITTED` (1004) - When detective applies
- **Approved**: `DETECTIVE_APPLICATION_APPROVED` (1005) - Application approval
- **Rejected**: `DETECTIVE_APPLICATION_REJECTED` (1006) - Application rejection
- **Claimable Invitation**: `CLAIMABLE_ACCOUNT_INVITATION` (1007) - Admin creates claimable profile
- **Claimable Credentials**: `CLAIMABLE_ACCOUNT_CREDENTIALS` (1008) - Temporary password email
- **Claim Finalized**: `CLAIMABLE_ACCOUNT_FINALIZED` (1009) - Claim completion
- **Status**: All implemented (but not sending due to Issue #1)

### Contact Form Email ✅
- **Endpoint**: `POST /api/contact`
- **Template**: `CONTACT_FORM` (5001)
- **Trigger**: Contact form submission
- **Variables**: `firstName`, `lastName`, `email`, `message`
- **Recipient**: `contact@askdetectives.com`
- **Status**: Implemented (but not sending due to Issue #1)

---

## 📋 SMTP CONFIGURATION STATUS

### Database Configuration ✅
```
✅ smtp_host: YES
✅ smtp_port: YES
✅ smtp_secure: YES
✅ smtp_user: YES
✅ smtp_pass: YES
✅ smtp_from_email: YES
```

**Note**: SMTP is configured in database but **NOT USED** by application code. App uses SendPulse API.

---

## 🔧 EMAIL SERVICE ARCHITECTURE ISSUE

### Current Architecture (BROKEN)
```
Routes → sendpulseEmail (API) → SendPulse API ❌ (not configured)
                                              ↓
                                        Returns "mocked: true"
                                        NO EMAIL SENT
```

### What Should Happen
```
Routes → sendpulseEmail (API) → SendPulse API ✅ (with credentials)
                                              ↓
                                        Template rendering
                                        Email sent via SendPulse
```

### Alternative (If switching to SMTP)
```
Routes → emailService → nodemailer → SMTP Server ✅
                                              ↓
                                        Direct email send
```

---

## 🎯 PRE-LAUNCH CHECKLIST

### BLOCKING (Must Complete)
- [ ] **FIX CRITICAL**: Configure SendPulse API credentials OR refactor to use SMTP
- [ ] **Verify ALL email templates exist in SendPulse dashboard with correct IDs**
- [ ] **Test registration welcome email** (sign up new account)
- [ ] **Test payment confirmation email** (complete test payment)
- [ ] **Test detective application emails** (submit + approve application)
- [ ] **Implement forgot password flow** (endpoints + frontend)
- [ ] **Test forgot password + reset flow end-to-end**

### HIGHLY RECOMMENDED
- [ ] Implement email verification flow
- [ ] Test all 20+ email templates with real SendPulse
- [ ] Set up email monitoring/alerting for failures
- [ ] Configure proper sender domain (SPF, DKIM, DMARC)
- [ ] Test spam score of emails
- [ ] Set `ADMIN_EMAIL` environment variable for admin notifications

### NICE TO HAVE
- [ ] Add email send retry logic with exponential backoff
- [ ] Log all email attempts to database for audit trail
- [ ] Create admin dashboard to view email send history
- [ ] Add email template preview in admin panel

---

## 📊 EMAIL TEMPLATE INVENTORY (20 templates)

### Auth & User (3)
1. ✅ `WELCOME_USER` (1001) - Registration welcome
2. ⚠️ `EMAIL_VERIFICATION` (1002) - **Not implemented**
3. 🚫 `PASSWORD_RESET` (1003) - **Not implemented**

### Detective Flows (6)
4. ✅ `DETECTIVE_APPLICATION_SUBMITTED` (1004)
5. ✅ `DETECTIVE_APPLICATION_APPROVED` (1005)
6. ✅ `DETECTIVE_APPLICATION_REJECTED` (1006)
7. ✅ `CLAIMABLE_ACCOUNT_INVITATION` (1007)
8. ✅ `CLAIMABLE_ACCOUNT_CREDENTIALS` (1008)
9. ✅ `CLAIMABLE_ACCOUNT_FINALIZED` (1009)

### Payments (7)
10. ✅ `PAYMENT_SUCCESS` (2001)
11. ⚠️ `PAYMENT_FAILURE` (2002) - Template exists, verify usage
12. ⚠️ `SUBSCRIPTION_ACTIVATED` (2003) - Template exists, verify usage
13. ⚠️ `SUBSCRIPTION_EXPIRED` (2004) - Template exists, verify usage
14. ⚠️ `SUBSCRIPTION_RENEWING_SOON` (2005) - Template exists, verify usage
15. ⚠️ `DOWNGRADE_SCHEDULED` (2006) - Template exists, verify usage
16. ⚠️ `FREE_PLAN_APPLIED` (2007) - Template exists, verify usage
17. ✅ `BLUE_TICK_PURCHASE_SUCCESS` (2008)

### Admin (3)
18. ✅ `ADMIN_NEW_SIGNUP` (3001)
19. ✅ `ADMIN_NEW_PAYMENT` (3002)
20. ✅ `ADMIN_APPLICATION_RECEIVED` (3003)

### Contact (1)
21. ✅ `CONTACT_FORM` (5001)

---

## 🚀 RECOMMENDED ACTION PLAN

### Phase 1: IMMEDIATE (BEFORE LAUNCH) - 2-4 hours
1. **Enable SendPulse API**:
   - Get SendPulse API credentials from dashboard
   - Update `.env` with real credentials
   - Set `SENDPULSE_ENABLED=true`

2. **Verify SendPulse Templates**:
   - Log into SendPulse dashboard
   - Confirm all 20+ template IDs match `EMAIL_TEMPLATES` constants
   - Test template rendering with sample data

3. **Test Critical Flows**:
   - Create test user account → verify welcome email received
   - Complete test payment → verify payment email received
   - Submit contact form → verify email received at admin

### Phase 2: URGENT (FIRST WEEK) - 4-6 hours
1. **Implement Forgot Password Flow**:
   - Create database table for reset tokens
   - Build forgot password API endpoints
   - Create reset password frontend page
   - Test end-to-end flow

### Phase 3: RECOMMENDED (FIRST MONTH) - 3-4 hours
1. **Implement Email Verification**:
   - Add email_verified column
   - Generate verification tokens on signup
   - Build verification endpoint
   - Update UI to show unverified banner

---

## 📝 CONFIGURATION CHECKLIST

```env
# ✅ Required for Production
NODE_ENV=production
DATABASE_URL=your-production-db-url
SESSION_SECRET=your-secure-random-secret-32-chars-minimum
BASE_URL=https://askdetectives.com
ADMIN_EMAIL=admin@askdetectives.com

# 🔴 CRITICAL - Not configured (blocks ALL emails)
SENDPULSE_API_ID=GET_FROM_SENDPULSE_DASHBOARD
SENDPULSE_API_SECRET=GET_FROM_SENDPULSE_DASHBOARD
SENDPULSE_SENDER_EMAIL=contact@askdetectives.com
SENDPULSE_SENDER_NAME=Ask Detectives
SENDPULSE_ENABLED=true

# ✅ Payment
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret

# ✅ Storage
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## ⚠️ FINAL VERDICT

**STATUS**: 🔴 **NOT READY FOR PRODUCTION**

**Blocking Issues**: 2 critical
1. Email service not configured (no emails will send)
2. Forgot password not implemented (users will be locked out)

**Estimated Time to Production Ready**: 6-10 hours of development + testing

**Recommendation**: **DO NOT LAUNCH** until:
1. SendPulse API credentials are configured and tested
2. All critical emails verified working (registration, payment, applications)
3. Forgot password flow implemented and tested
4. Production smoke test completed with real email addresses

---

## 📞 SUPPORT CONTACTS

If you need help:
- SendPulse Support: https://sendpulse.com/support
- SendPulse API Docs: https://sendpulse.com/api
- SMTP Configuration Guide: See `server/config.ts` and `server/email.ts`

---

**Generated**: February 12, 2026  
**Review Required**: Before production deployment  
**Next Audit**: After fixes implemented
