-- Add all email templates to the database
-- Run this file to insert email templates into your live database

INSERT INTO "public"."email_templates" ("id", "key", "name", "description", "subject", "body", "sendpulse_template_id", "is_active", "created_at", "updated_at") VALUES
	('40563eb7-a036-4c1e-9842-c032e6f11c97', 'DETECTIVE_APPLICATION_SUBMITTED', 'Detective Application Submitted', 'Confirmation when detective application is submitted', 'Application Received — Ask Detectives', 'Hello {{detectiveName}},

Thank you for applying to join Ask Detectives!

We have received your application and our team will review it within 24-48 hours.

Application Details:
- Business Name: {{businessName}}
- Country: {{country}}
- Submitted: {{submittedAt}}

You will receive an email once your application is reviewed.

Best regards,
Ask Detectives Team', 1004, true, '2026-01-28 10:36:08.961594', '2026-01-28 10:36:08.961594'),
	('834ade50-a5e5-473e-a03d-15a06c7774f9', 'DETECTIVE_APPLICATION_APPROVED', 'Detective Application Approved', 'Notification when detective application is approved', 'Application Approved! Welcome to Ask Detectives', 'Hello {{detectiveName}},

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
Ask Detectives Team', 1005, true, '2026-01-28 10:36:08.989217', '2026-01-28 10:36:08.989217'),
	('d7f8c283-b76b-4cce-bd60-45b723aa4a17', 'DETECTIVE_APPLICATION_REJECTED', 'Detective Application Rejected', 'Notification when detective application is rejected', 'Application Update — Ask Detectives', 'Hello {{detectiveName}},

Thank you for your interest in Ask Detectives.

After careful review, we are unable to approve your application at this time.

Reason: {{rejectionReason}}

You may reapply after addressing the concerns mentioned above.

If you have questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team', 1006, true, '2026-01-28 10:36:09.013694', '2026-01-28 10:36:09.013694'),
	('e9a1e5ce-7930-4b0a-9415-2b0e603af2c2', 'CLAIMABLE_ACCOUNT_INVITATION', 'Claimable Account Invitation', 'Invitation to claim admin-created detective account', 'Your Account Has Been Added — Claim It Now', 'Hello {{detectiveName}},

Congratulations! Your account has been added to Ask Detectives.

Claim your account: {{claimLink}}

This link expires in 48 hours.

After claiming, you will receive your login credentials.

Best regards,
Ask Detectives Team', 1007, true, '2026-01-28 10:36:09.036271', '2026-01-28 10:36:09.036271'),
	('5fa00382-f336-4c8d-8d65-a21f4341f363', 'CLAIMABLE_ACCOUNT_CREDENTIALS', 'Claimable Account Credentials', 'Temporary password for claimed account', 'You Can Now Log In — Ask Detectives', 'Hello {{detectiveName}},

Your account has been successfully claimed!

Login Details:
Email: {{loginEmail}}
Temporary Password: {{tempPassword}}

Login: {{loginUrl}}

Please change your password after logging in for security.

If you have any questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team', 1008, true, '2026-01-28 10:36:09.062986', '2026-01-28 10:36:09.062986'),
	('49c8f02e-3e19-4f72-ad4e-a5f6191fef8b', 'CLAIMABLE_ACCOUNT_FINALIZED', 'Claimable Account Finalized', 'Confirmation that claim process is complete', 'Your Account is Ready — Ask Detectives', 'Hello {{detectiveName}},

Great news! Your account claim has been finalized.

Your account is now fully active and ready to use.

Login Email: {{loginEmail}}
Login: {{loginUrl}}

If you need assistance, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team', 1009, true, '2026-01-28 10:36:09.08745', '2026-01-28 10:36:09.08745'),
	('8e23b8d7-5134-4256-9778-a2b0995bcc3b', 'SUBSCRIPTION_ACTIVATED', 'Subscription Activated', 'Confirmation when subscription is activated', 'Subscription Activated — Ask Detectives', 'Hello {{detectiveName}},

Your subscription has been activated!

Plan: {{planName}}
Billing Cycle: {{billingCycle}}
Expires: {{expiresAt}}

Features:
{{features}}

Manage your subscription: {{subscriptionUrl}}

Best regards,
Ask Detectives Team', 2003, true, '2026-01-28 10:36:09.211219', '2026-01-28 10:36:09.211219'),
	('71766a76-62e4-4759-8732-757b6946b2c4', 'SUBSCRIPTION_EXPIRED', 'Subscription Expired', 'Notification when subscription expires', 'Your Subscription Has Expired — Ask Detectives', 'Hello {{detectiveName}},

Your subscription has expired.

Previous Plan: {{planName}}
Expired: {{expiredAt}}

Renew your subscription to continue accessing premium features:

Renew: {{renewUrl}}

If you have questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team', 2004, true, '2026-01-28 10:36:09.26676', '2026-01-28 10:36:09.26676'),
	('f5b201fc-e96a-4f10-88c2-866b8b2c4893', 'SUBSCRIPTION_RENEWING_SOON', 'Subscription Renewing Soon', 'Reminder that subscription will renew soon', 'Your Subscription Will Renew Soon — Ask Detectives', 'Hello {{detectiveName}},

Your subscription will renew soon.

Plan: {{planName}}
Renews: {{renewsAt}}
Amount: {{amount}}

Your payment method will be charged automatically.

Manage subscription: {{subscriptionUrl}}

Best regards,
Ask Detectives Team', 2005, true, '2026-01-28 10:36:09.294242', '2026-01-28 10:36:09.294242'),
	('24ef5bd3-59c8-4e8b-8d37-8ca00a3f2184', 'PAYMENT_SUCCESS', 'Payment Success', 'Confirmation of successful payment', 'Payment Received — Ask Detectives', 'Hello {{detectiveName}},

We have received your payment.

Transaction Details:
Amount: {{amount}}
Plan: {{planName}}
Date: {{paymentDate}}
Transaction ID: {{transactionId}}

Receipt: {{receiptUrl}}

Best regards,
Ask Detectives Team', 2001, true, '2026-01-28 10:36:09.324865', '2026-01-28 10:36:09.324865'),
	('5c4b1574-b66f-4794-a24f-dd75cfce9b05', 'PAYMENT_FAILURE', 'Payment Failed', 'Notification when payment fails', 'Payment Failed — Ask Detectives', 'Hello {{detectiveName}},

We were unable to process your payment.

Amount: {{amount}}
Reason: {{failureReason}}

Please update your payment method: {{paymentUrl}}

If you have questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team', 2002, true, '2026-01-28 10:36:09.353602', '2026-01-28 10:36:09.353602'),
	('e532fada-d203-4a1a-889a-c676128f8e81', 'BLUE_TICK_PURCHASE', 'Blue Tick Purchase', 'Confirmation of Blue Tick verification purchase', 'Blue Tick Verification Activated — Ask Detectives', 'Hello {{detectiveName}},

Your Blue Tick verification has been activated!

This badge appears on your profile and indicates verified status.

Payment Details:
Amount: {{amount}}
Date: {{activatedAt}}

View your profile: {{profileUrl}}

Best regards,
Ask Detectives Team', 3001, true, '2026-01-28 10:36:09.376281', '2026-01-28 10:36:09.376281'),
	('f1d985f2-df75-48c7-8ef7-058f22df7a6c', 'ADMIN_NEW_SIGNUP', 'Admin: New Signup', 'Notification to admin when new detective signs up', '[Admin] New Detective Signup', 'New detective application submitted:

Detective: {{detectiveName}}
Business: {{businessName}}
Email: {{email}}
Country: {{country}}
Submitted: {{submittedAt}}

Review application: {{reviewUrl}}

- Ask Detectives Admin System', 9001, true, '2026-01-28 10:36:09.403494', '2026-01-28 10:36:09.403494'),
	('08103d1e-67e6-4764-b734-b59471389720', 'SIGNUP_WELCOME', 'Signup Welcome', 'Sent when a new user signs up for an account', 'Welcome to Ask Detectives!', 'Hello {{userName}},

Welcome to Ask Detectives! Your account has been created successfully.

Get started by exploring our services or completing your profile.

Login: {{loginUrl}}

If you have any questions, contact us at {{supportEmail}}.

Best regards,
Ask Detectives Team', 70568, true, '2026-01-28 10:36:08.856405', '2026-01-28 13:59:23.926'),
	('eac7c39c-cf8a-426c-a19b-2d2fa9ddd10c', 'EMAIL_VERIFICATION', 'Email Verification', 'Sent to verify user email address', 'Verify Your Email — Ask Detectives', 'Hello {{userName}},

Please verify your email address by clicking the link below:

{{verificationLink}}

This link will expire in 24 hours.

If you didn''t create this account, please ignore this email.

Best regards,
Ask Detectives Team', 70577, true, '2026-01-28 10:36:08.905314', '2026-01-28 14:16:14.341'),
	('58581507-41b7-4e19-9cc2-745930205d04', 'PASSWORD_RESET', 'Password Reset', 'Sent when user requests password reset', 'Reset Your Password — Ask Detectives', 'Hello {{userName}},

We received a request to reset your password.

Reset your password: {{resetLink}}

This link will expire in 1 hour.

If you didn''t request this, please ignore this email.

Best regards,
Ask Detectives Team', 70578, true, '2026-01-28 10:36:08.936332', '2026-01-28 14:17:22.855')
ON CONFLICT (id) DO NOTHING;
