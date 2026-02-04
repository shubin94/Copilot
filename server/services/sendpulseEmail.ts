/**
 * SendPulse Email Service
 * 
 * Centralized email sending across the platform.
 * All templates managed in SendPulse dashboard - code only references template IDs.
 * 
 * SECURITY:
 * - API credentials stored in .env only
 * - Never logged or exposed to frontend
 * - Graceful failure handling (non-blocking)
 * 
 * DEVELOPMENT:
 * - NODE_ENV !== "production" → logs only, does not send (unless SENDPULSE_ENABLED=true)
 */

interface EmailVariable {
  [key: string]: string | number | boolean | null | undefined;
}

interface EmailOptions {
  to: string;
  templateId: number;
  variables: EmailVariable;
  replyTo?: string;
}

interface AdminEmailOptions {
  templateId: number;
  variables: EmailVariable;
}

interface SendPulseTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SendPulseEmailResponse {
  result: {
    status: boolean;
    id?: string;
  };
}

class SendPulseEmailService {
  private apiId: string;
  private apiSecret: string;
  private senderEmail: string;
  private senderName: string;
  private enabled: boolean;
  private isProd: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.apiId = process.env.SENDPULSE_API_ID || "";
    this.apiSecret = process.env.SENDPULSE_API_SECRET || "";
    this.senderEmail = process.env.SENDPULSE_SENDER_EMAIL || "noreply@example.com";
    this.senderName = process.env.SENDPULSE_SENDER_NAME || "Ask Detectives";
    this.enabled = process.env.SENDPULSE_ENABLED === "true";
    this.isProd = process.env.NODE_ENV === "production";

    if (!this.apiId || !this.apiSecret) {
      console.warn(
        "[SendPulse] Warning: API credentials not configured. Email sending disabled."
      );
      this.enabled = false;
    }
  }

  /**
   * Get valid access token from SendPulse
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.apiId,
          client_secret: this.apiSecret,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as SendPulseTokenResponse;
      this.accessToken = data.access_token;
      // Cache for expires_in - 60 seconds buffer
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error("[SendPulse] Failed to get access token:", error);
      throw error;
    }
  }

  /**
   * Send transactional email with template
   * @param to Recipient email address
   * @param templateId SendPulse template ID
   * @param variables Dynamic variables for template personalization
   */
  async sendTransactionalEmail(
    to: string,
    templateId: number,
    variables: EmailVariable,
    subject: string = "Welcome to Ask Detectives"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate recipient email first
      if (!to || to === "undefined" || to === "null") {
        console.error("[SendPulse] ❌ Cannot send email: Recipient email is undefined or invalid", {
          to,
          templateId,
        });
        return { success: false, error: "Recipient email is undefined" };
      }

      // Validate template ID
      if (!templateId) {
        console.error("[SendPulse] Missing template ID", { to, templateId });
        return { success: false, error: "Missing template ID" };
      }

      // Check if SendPulse is enabled
      if (!this.enabled) {
        console.log("[SendPulse] ⚠️ SendPulse is disabled in config. Skipping email.");
        return { success: true, mocked: true };
      }

      const token = await this.getAccessToken();

      // ✅ CORRECT structure for SendPulse SMTP API with email wrapper
      const payload = {
        email: {
          subject,
          template: {
            id: templateId,
            variables: this.sanitizeVariables(variables),
          },
          from: {
            name: this.senderName,
            email: this.senderEmail, // MUST be contact@askdetectives.com
          },
          to: [
            {
              email: to,
              name: this.extractNameFromVariables(variables),
            },
          ],
        },
      };

      console.log("[SendPulse] Sending with payload:", JSON.stringify(payload, null, 2));

      const response = await fetch("https://api.sendpulse.com/smtp/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }
        
        console.error(`[SendPulse] HTTP ${response.status} Error`, {
          templateId,
          recipient: to,
          statusText: response.statusText,
          error: errorData,
          timestamp: new Date().toISOString(),
        });
        
        throw new Error(`SendPulse API error: ${response.statusText}`);
      }

      const result = (await response.json()) as SendPulseEmailResponse;

      if (result.result?.status) {
        console.log(
          `[SendPulse] ✅ Email sent successfully to ${to} (Template: ${templateId})`
        );
        return { success: true };
      } else {
        console.error(
          `[SendPulse] ❌ API returned failure:`,
          {
            templateId,
            recipient: to,
            apiResponse: result,
            timestamp: new Date().toISOString(),
          }
        );
        return { success: false, error: "API returned failure status" };
      }
    } catch (error) {
      // Non-blocking: log error but don't throw
      console.error(
        `[SendPulse] ❌ Email send failed (attempt 1/2):`,
        {
          templateId,
          recipient: to,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }
      );

      // Retry once on failure
      try {
        console.log(`[SendPulse] 🔄 Retrying email to ${to}...`);
        this.accessToken = null; // Clear token to force refresh
        const token = await this.getAccessToken();

        // ✅ CORRECT structure for SendPulse SMTP API with email wrapper
        const payload = {
          email: {
            subject: "Welcome to Ask Detectives",
            template: {
              id: templateId,
              variables: this.sanitizeVariables(variables),
            },
            from: {
              name: this.senderName,
              email: this.senderEmail, // MUST be contact@askdetectives.com
            },
            to: [
              {
                email: to,
                name: this.extractNameFromVariables(variables),
              },
            ],
          },
        };

        const retryResponse = await fetch("https://api.sendpulse.com/smtp/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (retryResponse.ok) {
          const result = (await retryResponse.json()) as SendPulseEmailResponse;
          if (result.result?.status) {
            console.log(`[SendPulse] ✅ Retry successful for ${to} (Template: ${templateId})`);
            return { success: true };
          }
        }
      } catch (retryError) {
        console.error(
          `[SendPulse] ❌ Retry failed (attempt 2/2):`,
          {
            templateId,
            recipient: to,
            error: retryError instanceof Error ? retryError.message : String(retryError),
            timestamp: new Date().toISOString(),
          }
        );
      }

      // Return failure - email sending did not succeed
      return { success: false, error: "Failed to send email after 2 attempts" };
    }
  }

  /**
   * Extract recipient name from template variables
   * Tries common name fields: userName, detectiveName, name
   */
  private extractNameFromVariables(variables: EmailVariable): string {
    return (
      (variables.userName as string) ||
      (variables.detectiveName as string) ||
      (variables.name as string) ||
      "Valued Customer"
    );
  }

  /**
   * Send email to admin
   * Uses the same template system but sends to admin email from env
   * 
   * SECURITY: Admin email must be configured via ADMIN_EMAIL environment variable.
   * No hardcoded fallback to prevent accidental email leaks.
   */
  async sendAdminEmail(
    templateId: number,
    variables: EmailVariable
  ): Promise<{ success: boolean; error?: string }> {
    const adminEmail = process.env.ADMIN_EMAIL;
    
    if (!adminEmail) {
      console.error("[SendPulse] ADMIN_EMAIL not configured - cannot send admin notification");
      return { 
        success: false, 
        error: "ADMIN_EMAIL environment variable not configured" 
      };
    }
    
    return this.sendTransactionalEmail(adminEmail, templateId, variables);
  }

  /**
   * Sanitize variables to ensure they're safe for template rendering
   */
  private sanitizeVariables(variables: EmailVariable): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(variables)) {
      // Convert all values to strings for template rendering
      if (value === null || value === undefined) {
        sanitized[key] = "";
      } else if (typeof value === "boolean") {
        sanitized[key] = value ? "true" : "false";
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Check if email sending is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.isProd;
  }

  /**
   * Get configuration status (for debugging)
   */
  getStatus(): {
    enabled: boolean;
    isProduction: boolean;
    senderEmail: string;
    senderName: string;
  } {
    return {
      enabled: this.enabled,
      isProduction: this.isProd,
      senderEmail: this.senderEmail,
      senderName: this.senderName,
    };
  }
}

// Export singleton instance
export const sendpulseEmail = new SendPulseEmailService();

/**
 * Email Template IDs (managed in SendPulse dashboard)
 * 
 * Update these IDs to match your SendPulse template IDs
 * 
 * AUTH TEMPLATES
 */
export const EMAIL_TEMPLATES = {
  // User & Auth
  WELCOME_USER: 1001, // Welcome email for new user signup
  EMAIL_VERIFICATION: 1002, // Email verification link
  PASSWORD_RESET: 1003, // Password reset instructions

  // Detective Signup & Approval
  DETECTIVE_APPLICATION_SUBMITTED: 1004, // Confirmation when detective applies
  DETECTIVE_APPLICATION_APPROVED: 1005, // Notification when application approved
  DETECTIVE_APPLICATION_REJECTED: 1006, // Notification when application rejected
  CLAIMABLE_ACCOUNT_INVITATION: 1007, // Invitation to claim admin-created account
  CLAIMABLE_ACCOUNT_CREDENTIALS: 1008, // Temporary password for claimed account
  CLAIMABLE_ACCOUNT_FINALIZED: 1009, // Confirmation that claim process completed

  // Payments & Subscription
  PAYMENT_SUCCESS: 2001, // Payment confirmation
  PAYMENT_FAILURE: 2002, // Payment failed notification
  SUBSCRIPTION_ACTIVATED: 2003, // Subscription activated
  SUBSCRIPTION_EXPIRED: 2004, // Subscription expired
  SUBSCRIPTION_RENEWING_SOON: 2005, // Subscription about to renew
  DOWNGRADE_SCHEDULED: 2006, // Downgrade scheduled notification
  FREE_PLAN_APPLIED: 2007, // Free plan applied (downgrade)
  BLUE_TICK_PURCHASE_SUCCESS: 2008, // Blue tick purchase success

  // Admin Notifications
  ADMIN_NEW_SIGNUP: 3001, // Admin: New detective signup
  ADMIN_NEW_PAYMENT: 3002, // Admin: New payment received
  ADMIN_APPLICATION_RECEIVED: 3003, // Admin: New application to review

  // Contact
  CONTACT_FORM: 5001, // Contact form submission

  // Profile & Account
  PROFILE_CLAIM_APPROVED: 4001, // Profile claim approved
  PROFILE_CLAIM_TEMPORARY_PASSWORD: 4002, // Temporary password for claimed profile
};
