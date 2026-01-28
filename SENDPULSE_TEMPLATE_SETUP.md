# SendPulse Template Setup Checklist

This file lists all SendPulse email templates that need to be created in your SendPulse dashboard.

## Setup Instructions

1. Log in to [SendPulse Dashboard](https://sendpulse.com)
2. Navigate to **Email** → **Templates**
3. Create each template below with the exact ID and name
4. Use the template variables listed for dynamic personalization
5. Design templates according to your brand guidelines

---

## Templates to Create

### ✅ User & Auth Emails

#### Template 1001: Welcome User
- **ID:** 1001
- **Name:** Welcome User
- **Type:** Transactional
- **Subject:** Welcome to Ask Detectives!
- **Variables:** `%%userName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Sent immediately after user signup
- **Example Subject:** Welcome to Ask Detectives, {{userName}}!

#### Template 1002: Email Verification
- **ID:** 1002
- **Name:** Email Verification
- **Type:** Transactional
- **Subject:** Verify Your Email Address
- **Variables:** `%%userName%%`, `%%verificationLink%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Verify user email before account activation
- **Note:** Include button with `%%verificationLink%%`

#### Template 1003: Password Reset
- **ID:** 1003
- **Name:** Password Reset
- **Type:** Transactional
- **Subject:** Reset Your Password
- **Variables:** `%%userName%%`, `%%resetLink%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Send password reset instructions
- **Note:** Include button with `%%resetLink%%` and expiration notice

---

### ✅ Detective Signup & Approval

#### Template 1004: Detective Application Submitted
- **ID:** 1004
- **Name:** Detective Application Submitted
- **Type:** Transactional
- **Subject:** Your Detective Application Received
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Confirmation after detective submits application
- **Tone:** Professional, encouraging

#### Template 1005: Detective Application Approved
- **ID:** 1005
- **Name:** Detective Application Approved
- **Type:** Transactional
- **Subject:** Your Application is Approved! 🎉
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Approval notification
- **Include:** Login link, next steps for profile setup

#### Template 1006: Detective Application Rejected
- **ID:** 1006
- **Name:** Detective Application Rejected
- **Type:** Transactional
- **Subject:** Application Status Update
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%rejectionReason%%`, `%%supportEmail%%`
- **Purpose:** Rejection notification
- **Include:** Reason for rejection, reapplication instructions

#### Template 1007: Claimable Account Invitation
- **ID:** 1007
- **Name:** Claimable Account Invitation
- **Type:** Transactional
- **Subject:** Your Account has been Added to Ask Detectives - Claim It
- **Variables:** `%%detectiveName%%`, `%%claimLink%%`, `%%supportEmail%%`
- **Purpose:** Invitation to claim admin-created account
- **Include:** 
  - Greeting by name
  - Message: "Your account has been added to the Ask Detective platform. You can claim your account using the link below."
  - Claim button/link (%%claimLink%%)
  - Footer: "If this account does not belong to you, please contact support to delete this account."
  - Token expires in 48 hours message

#### Template 1008: Claimable Account Credentials
- **ID:** 1008
- **Name:** Claimable Account Credentials (Temporary Password)
- **Type:** Transactional
- **Subject:** You Can Now Log In to Ask Detectives
- **Variables:** `%%detectiveName%%`, `%%loginEmail%%`, `%%tempPassword%%`, `%%loginUrl%%`, `%%supportEmail%%`
- **Purpose:** Send temporary password after account claim
- **Include:**
  - Greeting: "Hello %%detectiveName%%"
  - Message: "Your account has been successfully claimed. You can now log in using the details below."
  - Login Email: %%loginEmail%%
  - Temporary Password: %%tempPassword%% (plain text, monospace font)
  - Login button/link: %%loginUrl%%
  - Security note: "Please change your password after logging in for security."
  - Support contact: %%supportEmail%%

---

### ✅ Payments & Subscription

#### Template 2001: Payment Success
- **ID:** 2001
- **Name:** Payment Success
- **Type:** Transactional
- **Subject:** Payment Confirmed - Your Subscription is Active
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%packageName%%`, `%%billingCycle%%`, `%%amount%%`, `%%currency%%`, `%%subscriptionExpiryDate%%`, `%%supportEmail%%`
- **Purpose:** Payment confirmation
- **Include:** Invoice details, subscription end date, next billing date

#### Template 2002: Payment Failure
- **ID:** 2002
- **Name:** Payment Failure
- **Type:** Transactional
- **Subject:** Payment Failed - Action Required
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Payment failed notification
- **Include:** Retry button, support contact

#### Template 2003: Subscription Activated
- **ID:** 2003
- **Name:** Subscription Activated
- **Type:** Transactional
- **Subject:** Your Subscription is Now Active
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%packageName%%`, `%%subscriptionStartDate%%`, `%%subscriptionExpiryDate%%`, `%%supportEmail%%`
- **Purpose:** Subscription activation confirmation
- **Include:** Features unlocked, usage guide link

#### Template 2004: Subscription Expired
- **ID:** 2004
- **Name:** Subscription Expired
- **Type:** Transactional
- **Subject:** Your Subscription Has Expired
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Subscription expiration notice
- **Include:** Renewal button, feature limitations info

#### Template 2005: Subscription Renewing Soon
- **ID:** 2005
- **Name:** Subscription Renewing Soon
- **Type:** Transactional
- **Subject:** Your Subscription Renews in 7 Days
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%renewalDate%%`, `%%amount%%`, `%%supportEmail%%`
- **Purpose:** Renewal reminder (7 days before)
- **Include:** Renewal date, amount, cancel instructions

#### Template 2006: Downgrade Scheduled
- **ID:** 2006
- **Name:** Downgrade Scheduled
- **Type:** Transactional
- **Subject:** Subscription Downgrade Scheduled
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%currentPackage%%`, `%%downgradeDate%%`, `%%supportEmail%%`
- **Purpose:** Downgrade notification
- **Include:** Effective date, new features available

#### Template 2007: Free Plan Applied
- **ID:** 2007
- **Name:** Free Plan Applied
- **Type:** Transactional
- **Subject:** You're Now on the Free Plan
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Downgrade to free plan
- **Include:** Feature comparison, upgrade button

#### Template 2008: Blue Tick Purchase Success
- **ID:** 2008
- **Name:** Blue Tick Purchase Success
- **Type:** Transactional
- **Subject:** Blue Tick Activated! Your Profile is Verified
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Blue tick purchase confirmation
- **Include:** Verification badge info, profile link

---

### ✅ Admin Notifications

#### Template 3001: New Detective Signup
- **ID:** 3001
- **Name:** Admin - New Detective Signup
- **Type:** Transactional
- **Subject:** [ADMIN] New Detective Signup
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%country%%`, `%%businessType%%`, `%%supportEmail%%`
- **Purpose:** Admin notification of new signup
- **Include:** Review link to admin panel

#### Template 3002: New Payment Received
- **ID:** 3002
- **Name:** Admin - New Payment Received
- **Type:** Transactional
- **Subject:** [ADMIN] New Payment Received
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%packageName%%`, `%%amount%%`, `%%currency%%`, `%%supportEmail%%`
- **Purpose:** Admin notification of payment
- **Include:** Payment ID, detective link

#### Template 3003: Application Received
- **ID:** 3003
- **Name:** Admin - Application Received
- **Type:** Transactional
- **Subject:** [ADMIN] New Application to Review
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%country%%`, `%%businessType%%`, `%%supportEmail%%`
- **Purpose:** Admin notification of application
- **Include:** Review link to admin panel

---

### ✅ Profile & Account

#### Template 4001: Profile Claim Approved
- **ID:** 4001
- **Name:** Profile Claim Approved
- **Type:** Transactional
- **Subject:** Your Profile Claim is Approved
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%supportEmail%%`
- **Purpose:** Profile claim approval notification
- **Include:** Login button, next steps

#### Template 4002: Temporary Password
- **ID:** 4002
- **Name:** Temporary Password
- **Type:** Transactional
- **Subject:** Your Temporary Password for Profile
- **Variables:** `%%detectiveName%%`, `%%email%%`, `%%temporaryPassword%%`, `%%supportEmail%%`
- **Purpose:** Send temporary password for claimed profile
- **Include:** Password in safe display, reset instructions, security notice

---

## Template Design Best Practices

### Structure
- Header with logo
- Greeting with recipient name
- Main content
- Call-to-action button (when appropriate)
- Footer with support email and unsubscribe link

### Variables
- Always use `%%variableName%%` format in templates
- Test with sample data before deploying
- Validate all variables are passed from code

### Tone
- **Transactional:** Professional, clear, action-oriented
- **Marketing:** Friendly, engaging, promotional (use for future campaigns)

### Compliance
- Include unsubscribe link in all templates
- Add privacy policy link
- Include company address
- Honor email preferences (transactional vs marketing)

---

## Verification Checklist

After creating all templates in SendPulse:

- [ ] All 21 templates created with correct IDs
- [ ] Each template has correct name matching the list
- [ ] All variables use correct format: `%%variableName%%`
- [ ] Test email sent for each template
- [ ] Sender email verified: contact@askdetectives.com
- [ ] Sender name set: Ask Detectives
- [ ] Unsubscribe links added to each template
- [ ] Privacy policy links included
- [ ] Company address in footer
- [ ] Logo/branding applied consistently

---

## Testing Email Flow

After template creation:

1. **Test User Registration:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Pass123!","name":"Test User"}'
   ```
   Check console for `[SendPulse] Email sent successfully...`

2. **Test Detective Application:**
   ```bash
   curl -X POST http://localhost:5000/api/applications \
     -H "Content-Type: application/json" \
     -d '{"email":"detective@example.com","password":"Pass123!","fullName":"Test Detective",...}'
   ```
   Should send 2 emails (to applicant and admin)

3. **Check SendPulse Dashboard:**
   - Navigate to **Emails** → **Sent**
   - Verify emails appear in sent list
   - Check delivery status

---

## Troubleshooting

**Template not found (404):**
- Verify template ID in SendPulse matches code
- Check template is published/active

**Variables not rendering:**
- Check variable names match exactly (case-sensitive)
- Verify format: `%%variableName%%`
- Test with sample data in SendPulse

**Emails not sending:**
- Verify `SENDPULSE_ENABLED=true` in `.env`
- Check API credentials
- Review server logs for `[SendPulse]` errors
- Verify recipient email is valid

---

**Status:** Ready for production setup
**Last Updated:** January 28, 2026
