/**
 * Resend Email Service
 * 
 * Simple, reliable transactional email sending using Resend SDK
 * API: https://resend.com
 */

import { Resend } from "resend";

interface EmailVariable {
  [key: string]: string | number | boolean | null | undefined;
}

class ResendEmailService {
  private resend: Resend;
  private senderEmail: string;
  private senderName: string;
  private enabled: boolean;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY || "";
    this.senderEmail = process.env.RESEND_SENDER_EMAIL || "contact@askdetectives.com";
    this.senderName = process.env.RESEND_SENDER_NAME || "Ask Detectives";
    this.enabled = !!apiKey;

    this.resend = new Resend(apiKey);

    if (!apiKey) {
      console.warn("[Resend] Warning: API key not configured. Email sending disabled.");
      this.enabled = false;
    }
  }

  /**
   * Send transactional email with template
   */
  async sendTransactionalEmail(
    to: string,
    templateId: number,
    variables?: EmailVariable
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      if (!to) {
        console.error("[Resend] Missing recipient email");
        return { success: false, error: "Missing recipient email" };
      }

      if (!this.enabled) {
        console.warn(`[Resend] Email sending disabled. Skipping email to ${to}`);
        return { success: true };
      }

      // Get template from database
      const { db } = await import("../../db/index.ts");
      const { emailTemplates } = await import("../../shared/schema.ts");
      const { eq } = await import("drizzle-orm");

      const template = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.sendpulseTemplateId, templateId))
        .limit(1)
        .then(r => r[0]);

      if (!template) {
        console.error(`[Resend] Template not found: ${templateId}`);
        return { success: false, error: `Template ${templateId} not found` };
      }

      // Build email subject and body
      let subject = template.subject || "Ask Detectives";
      let body = template.body || "";

      // Replace variables in subject and body
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = `{{${key}}}`;
          const stringValue = String(value || "");
          subject = subject.replace(new RegExp(placeholder, "g"), stringValue);
          body = body.replace(new RegExp(placeholder, "g"), stringValue);
        }
      }

      console.log(`[Resend] Sending email to ${to} (Template: ${templateId})`);

      // Send email using Resend SDK
      const response = await this.resend.emails.send({
        from: `${this.senderName} <${this.senderEmail}>`,
        to: to,
        subject: subject,
        html: body,
      });

      if (response.error) {
        console.error(`[Resend] Failed to send email:`, response.error);
        return { success: false, error: String(response.error) };
      }

      console.log(`[Resend] Email sent successfully to ${to}. ID: ${response.data?.id}`);
      return { success: true, messageId: response.data?.id };
    } catch (error) {
      console.error(
        `[Resend] Error sending email to ${to}:`,
        error instanceof Error ? error.message : String(error)
      );
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Check if email sending is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get configuration status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      senderEmail: this.senderEmail,
      senderName: this.senderName,
    };
  }
}

export const resendEmail = new ResendEmailService();
