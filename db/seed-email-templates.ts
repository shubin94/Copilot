import { db } from "./index";
import { emailTemplates } from "../shared/schema.ts";

/**
 * Seed default email templates
 * This creates the initial set of email templates for the platform
 * Run: npm run tsx db/seed-email-templates.ts
 */
async function seedEmailTemplates() {
  console.log("🌱 Seeding email templates...");

  const defaultTemplates = [
    // Authentication Templates
    {
      key: "SIGNUP_WELCOME",
      name: "Signup Welcome",
      description: "Sent when a new user signs up for an account",
      subject: "Welcome to Ask Detectives!",
      body: `Hello {{userName}},

Welcome to Ask Detectives! Your account has been created successfully.

Get started by exploring our services or completing your profile.

Login: {{loginUrl}}

If you have any questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1001,
      isActive: true,
    },
    {
      key: "EMAIL_VERIFICATION",
      name: "Email Verification",
      description: "Sent to verify user email address",
      subject: "Verify Your Email — Ask Detectives",
      body: `Hello {{userName}},

Please verify your email address by clicking the link below:

{{verificationLink}}

This link will expire in 24 hours.

If you didn't create this account, please ignore this email.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1002,
      isActive: true,
    },
    {
      key: "PASSWORD_RESET",
      name: "Password Reset",
      description: "Sent when user requests password reset",
      subject: "Reset Your Password — Ask Detectives",
      body: `Hello {{userName}},

We received a request to reset your password.

Reset your password: {{resetLink}}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1003,
      isActive: true,
    },

    // Detective Signup & Approval
    {
      key: "DETECTIVE_APPLICATION_SUBMITTED",
      name: "Detective Application Submitted",
      description: "Confirmation when detective application is submitted",
      subject: "Application Received — Ask Detectives",
      body: `Hello {{detectiveName}},

Thank you for applying to join Ask Detectives!

We have received your application and our team will review it within 24-48 hours.

Application Details:
- Business Name: {{businessName}}
- Country: {{country}}
- Submitted: {{submittedAt}}

You will receive an email once your application is reviewed.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1004,
      isActive: true,
    },
    {
      key: "DETECTIVE_APPLICATION_APPROVED",
      name: "Detective Application Approved",
      description: "Notification when detective application is approved",
      subject: "Application Approved! Welcome to Ask Detectives",
      body: `Hello {{detectiveName}},

Congratulations! Your application has been approved.

You can now log in and start setting up your profile:

Login: {{loginUrl}}
Dashboard: {{dashboardUrl}}

Next steps:
1. Complete your detective profile
2. Add your services
3. Set your pricing

If you need help, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1005,
      isActive: true,
    },
    {
      key: "DETECTIVE_APPLICATION_REJECTED",
      name: "Detective Application Rejected",
      description: "Notification when detective application is rejected",
      subject: "Application Update — Ask Detectives",
      body: `Hello {{detectiveName}},

Thank you for your interest in Ask Detectives.

After careful review, we are unable to approve your application at this time.

Reason: {{rejectionReason}}

You may reapply after addressing the concerns mentioned above.

If you have questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1006,
      isActive: true,
    },

    // Claimable Account Flow
    {
      key: "CLAIMABLE_ACCOUNT_INVITATION",
      name: "Claimable Account Invitation",
      description: "Invitation to claim admin-created detective account",
      subject: "Your Account Has Been Added — Claim It Now",
      body: `Hello {{detectiveName}},

Congratulations! Your account has been added to Ask Detectives.

Claim your account: {{claimLink}}

This link expires in 48 hours.

After claiming, you will receive your login credentials.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1007,
      isActive: true,
    },
    {
      key: "CLAIMABLE_ACCOUNT_CREDENTIALS",
      name: "Claimable Account Credentials",
      description: "Temporary password for claimed account",
      subject: "You Can Now Log In — Ask Detectives",
      body: `Hello {{detectiveName}},

Your account has been successfully claimed!

Login Details:
Email: {{loginEmail}}
Temporary Password: {{tempPassword}}

Login: {{loginUrl}}

Please change your password after logging in for security.

If you have any questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1008,
      isActive: true,
    },
    {
      key: "CLAIMABLE_ACCOUNT_FINALIZED",
      name: "Claimable Account Finalized",
      description: "Confirmation that claim process is complete",
      subject: "Your Account is Ready — Ask Detectives",
      body: `Hello {{detectiveName}},

Great news! Your account claim has been finalized.

Your account is now fully active and ready to use.

Login Email: {{loginEmail}}
Login: {{loginUrl}}

If you need assistance, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 1009,
      isActive: true,
    },

    // Subscription Templates
    {
      key: "SUBSCRIPTION_ACTIVATED",
      name: "Subscription Activated",
      description: "Confirmation when subscription is activated",
      subject: "Subscription Activated — Ask Detectives",
      body: `Hello {{detectiveName}},

Your subscription has been activated!

Plan: {{planName}}
Billing Cycle: {{billingCycle}}
Expires: {{expiresAt}}

Features:
{{features}}

Manage your subscription: {{subscriptionUrl}}

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 2003,
      isActive: true,
    },
    {
      key: "SUBSCRIPTION_EXPIRED",
      name: "Subscription Expired",
      description: "Notification when subscription expires",
      subject: "Your Subscription Has Expired — Ask Detectives",
      body: `Hello {{detectiveName}},

Your subscription has expired.

Previous Plan: {{planName}}
Expired: {{expiredAt}}

Renew your subscription to continue accessing premium features:

Renew: {{renewUrl}}

If you have questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 2004,
      isActive: true,
    },
    {
      key: "SUBSCRIPTION_RENEWING_SOON",
      name: "Subscription Renewing Soon",
      description: "Reminder that subscription will renew soon",
      subject: "Your Subscription Will Renew Soon — Ask Detectives",
      body: `Hello {{detectiveName}},

Your subscription will renew soon.

Plan: {{planName}}
Renews: {{renewsAt}}
Amount: {{amount}}

Your payment method will be charged automatically.

Manage subscription: {{subscriptionUrl}}

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 2005,
      isActive: true,
    },

    // Payment Templates
    {
      key: "PAYMENT_SUCCESS",
      name: "Payment Success",
      description: "Confirmation of successful payment",
      subject: "Payment Received — Ask Detectives",
      body: `Hello {{detectiveName}},

We have received your payment.

Transaction Details:
Amount: {{amount}}
Plan: {{planName}}
Date: {{paymentDate}}
Transaction ID: {{transactionId}}

Receipt: {{receiptUrl}}

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 2001,
      isActive: true,
    },
    {
      key: "PAYMENT_FAILURE",
      name: "Payment Failed",
      description: "Notification when payment fails",
      subject: "Payment Failed — Ask Detectives",
      body: `Hello {{detectiveName}},

We were unable to process your payment.

Amount: {{amount}}
Reason: {{failureReason}}

Please update your payment method: {{paymentUrl}}

If you have questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 2002,
      isActive: true,
    },

    // Blue Tick
    {
      key: "BLUE_TICK_PURCHASE",
      name: "Blue Tick Purchase",
      description: "Confirmation of Blue Tick verification purchase",
      subject: "Blue Tick Verification Activated — Ask Detectives",
      body: `Hello {{detectiveName}},

Your Blue Tick verification has been activated!

This badge appears on your profile and indicates verified status.

Payment Details:
Amount: {{amount}}
Date: {{activatedAt}}

View your profile: {{profileUrl}}

Best regards,
Ask Detectives Team`,
      sendpulseTemplateId: 3001,
      isActive: true,
    },

    // Admin Notifications
    {
      key: "ADMIN_NEW_SIGNUP",
      name: "Admin: New Signup",
      description: "Notification to admin when new detective signs up",
      subject: "[Admin] New Detective Signup",
      body: `New detective application submitted:

Detective: {{detectiveName}}
Business: {{businessName}}
Email: {{email}}
Country: {{country}}
Submitted: {{submittedAt}}

Review application: {{reviewUrl}}

- Ask Detectives Admin System`,
      sendpulseTemplateId: 9001,
      isActive: true,
    },
  ];

  // Insert templates
  for (const template of defaultTemplates) {
    try {
      await db.insert(emailTemplates).values(template);
      console.log(`✅ Created template: ${template.name}`);
    } catch (error: any) {
      if (error.code === "23505") {
        // Unique constraint violation (already exists)
        console.log(`⏭️  Template already exists: ${template.name}`);
      } else {
        console.error(`❌ Error creating template ${template.name}:`, error);
      }
    }
  }

  console.log("🎉 Email templates seeding complete!");
}

// Run seeding
seedEmailTemplates()
  .then(() => {
    console.log("✅ Seeding successful");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
