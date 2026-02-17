/**
 * SMTP Email Service
 * 
 * Simple, database-driven email service using existing SMTP configuration.
 * 
 * FEATURES:
 * - Uses SMTP credentials from app_secrets database
 * - Templates stored in email_templates table
 * - Simple variable substitution ({{variableName}})
 * - Graceful fallback in development
 * 
 * CONFIGURATION:
 * - SMTP credentials managed via /admin/app-secrets page
 * - No external API credentials required
 * - Works with any SMTP provider (SendPulse, Gmail, AWS SES, etc.)
 */

import nodemailer from "nodemailer";
import { config } from "../config.ts";
import { db } from "../../db/index.ts";
import { emailTemplates } from "../../shared/schema.ts";
import { eq } from "drizzle-orm";

interface EmailVariable {
  [key: string]: string | number | boolean | null | undefined;
}

interface SendEmailOptions {
  to: string;
  templateKey: string;
  variables: EmailVariable;
  replyTo?: string;
}

class SMTPEmailService {
  private templates: Map<string, { subject: string; body: string }> = new Map();
  private templatesLoaded: boolean = false;

  /**
   * Load email templates from database into memory cache
   */
  private async loadTemplates(): Promise<void> {
    if (this.templatesLoaded) return;

    try {
      const allTemplates = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.isActive, true));

      for (const template of allTemplates) {
        this.templates.set(template.key, {
          subject: template.subject,
          body: template.body,
        });
      }

      this.templatesLoaded = true;
      console.log(`[SMTP Email] Loaded ${this.templates.size} email templates from database`);
    } catch (error) {
      console.error("[SMTP Email] Failed to load templates:", error);
      throw error;
    }
  }

  /**
   * Replace template variables with actual values
   * Example: "Hello {{userName}}" + { userName: "John" } = "Hello John"
   */
  private replaceVariables(template: string, variables: EmailVariable): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = value != null ? String(value) : "";
      result = result.replaceAll(placeholder, replacement);
    }

    return result;
  }

  /**
   * Convert plain text email to simple HTML format
   */
  private textToHtml(text: string): string {
    // Convert line breaks to HTML
    const html = text
      .split("\n\n")
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    p { margin: 0 0 16px 0; }
    a { color: #16a34a; text-decoration: underline; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    ${html}
  </div>
</body>
</html>`;
  }

  /**
   * Send transactional email using database template
   * 
   * @param to - Recipient email address
   * @param templateKey - Template key from email_templates table (e.g., "WELCOME_USER", "PASSWORD_RESET")
   * @param variables - Key-value pairs for template variable substitution
   * @param replyTo - Optional reply-to email address
   */
  async sendTransactionalEmail(
    to: string,
    templateKey: string,
    variables: EmailVariable,
    replyTo?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate recipient
      if (!to || to === "undefined" || to === "null" || !to.includes("@")) {
        console.error("[SMTP Email] Invalid recipient email:", to);
        return { success: false, error: "Invalid recipient email" };
      }

      // Load templates if not already loaded
      await this.loadTemplates();

      // Get template
      const template = this.templates.get(templateKey);
      if (!template) {
        console.error(`[SMTP Email] Template not found: ${templateKey}`);
        return { success: false, error: `Template not found: ${templateKey}` };
      }

      // Replace variables in subject and body
      const subject = this.replaceVariables(template.subject, variables);
      const textBody = this.replaceVariables(template.body, variables);
      const htmlBody = this.textToHtml(textBody);

      // Check SMTP configuration
      const smtpHost = config.email.smtpHost;
      const smtpFromEmail = config.email.smtpFromEmail;

      if (!smtpHost || !smtpFromEmail) {
        if (config.env.isProd) {
          console.error("[SMTP Email] SMTP not configured in production");
          return { success: false, error: "SMTP not configured" };
        } else {
          // Development mode: log email instead of sending
          console.log("\n" + "=".repeat(60));
          console.log("[SMTP Email] 📧 DEVELOPMENT MODE - Email Not Sent");
          console.log("=".repeat(60));
          console.log(`To: ${to}`);
          console.log(`Template: ${templateKey}`);
          console.log(`Subject: ${subject}`);
          console.log(`Reply-To: ${replyTo || "N/A"}`);
          console.log("-".repeat(60));
          console.log(textBody);
          console.log("=".repeat(60) + "\n");
          return { success: true, mocked: true } as any;
        }
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: config.email.smtpPort ?? 587,
        secure: config.email.smtpSecure || (config.email.smtpPort === 465),
        auth:
          config.email.smtpUser && config.email.smtpPass
            ? {
                user: config.email.smtpUser,
                pass: config.email.smtpPass,
              }
            : undefined,
      } as any);

      // Send email
      await transporter.sendMail({
        from: {
          address: smtpFromEmail,
          name: "Ask Detectives",
        } as any,
        to,
        replyTo: replyTo || undefined,
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`[SMTP Email] ✅ Email sent successfully to ${to} (Template: ${templateKey})`);
      return { success: true };
    } catch (error) {
      console.error("[SMTP Email] Failed to send email:", {
        to,
        templateKey,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }

  /**
   * Send email to admin
   * Uses ADMIN_EMAIL environment variable
   */
  async sendAdminEmail(
    templateKey: string,
    variables: EmailVariable
  ): Promise<{ success: boolean; error?: string }> {
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.error("[SMTP Email] ADMIN_EMAIL not configured");
      return {
        success: false,
        error: "ADMIN_EMAIL environment variable not configured",
      };
    }

    return this.sendTransactionalEmail(adminEmail, templateKey, variables);
  }

  /**
   * Reload templates from database (useful after template updates)
   */
  async reloadTemplates(): Promise<void> {
    this.templatesLoaded = false;
    this.templates.clear();
    await this.loadTemplates();
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return !!(config.email.smtpHost && config.email.smtpFromEmail);
  }

  /**
   * Get service status for debugging
   */
  getStatus(): {
    configured: boolean;
    templatesLoaded: number;
    smtpHost: string | undefined;
    fromEmail: string | undefined;
  } {
    return {
      configured: this.isConfigured(),
      templatesLoaded: this.templates.size,
      smtpHost: config.email.smtpHost,
      fromEmail: config.email.smtpFromEmail,
    };
  }
}

// Export singleton instance
export const smtpEmailService = new SMTPEmailService();

/**
 * Template key constants (matches database email_templates.key column)
 */
export const EMAIL_TEMPLATE_KEYS = {
  // Auth & User
  WELCOME_USER: "SIGNUP_WELCOME",
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",

  // Detective Application
  DETECTIVE_APPLICATION_SUBMITTED: "DETECTIVE_APPLICATION_SUBMITTED",
  DETECTIVE_APPLICATION_APPROVED: "DETECTIVE_APPLICATION_APPROVED",
  DETECTIVE_APPLICATION_REJECTED: "DETECTIVE_APPLICATION_REJECTED",
  CLAIMABLE_ACCOUNT_INVITATION: "CLAIMABLE_ACCOUNT_INVITATION",
  CLAIMABLE_ACCOUNT_CREDENTIALS: "CLAIMABLE_ACCOUNT_CREDENTIALS",
  CLAIMABLE_ACCOUNT_FINALIZED: "CLAIMABLE_ACCOUNT_FINALIZED",

  // Payments
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILURE: "PAYMENT_FAILURE",
  SUBSCRIPTION_ACTIVATED: "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  SUBSCRIPTION_RENEWING_SOON: "SUBSCRIPTION_RENEWING_SOON",
  DOWNGRADE_SCHEDULED: "DOWNGRADE_SCHEDULED",
  FREE_PLAN_APPLIED: "FREE_PLAN_APPLIED",
  BLUE_TICK_PURCHASE_SUCCESS: "BLUE_TICK_PURCHASE_SUCCESS",

  // Admin Notifications
  ADMIN_NEW_SIGNUP: "ADMIN_NEW_SIGNUP",
  ADMIN_NEW_PAYMENT: "ADMIN_NEW_PAYMENT",
  ADMIN_APPLICATION_RECEIVED: "ADMIN_APPLICATION_RECEIVED",

  // Contact
  CONTACT_FORM: "CONTACT_FORM",

  // Profile
  PROFILE_CLAIM_APPROVED: "PROFILE_CLAIM_APPROVED",
  PROFILE_CLAIM_TEMPORARY_PASSWORD: "PROFILE_CLAIM_TEMPORARY_PASSWORD",
} as const;
