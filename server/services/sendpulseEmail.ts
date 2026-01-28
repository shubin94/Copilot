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
    variables: EmailVariable
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Development mode: log instead of sending
      if (!this.isProd && !this.enabled) {
        console.log("[SendPulse] DEV MODE - Email not sent:", {
          to,
          templateId,
          variables,
        });
        return { success: true }; // Non-blocking
      }

      // Validate inputs
      if (!to || !templateId) {
        console.error("[SendPulse] Missing required fields:", { to, templateId });
        return { success: false, error: "Missing email or template ID" };
      }

      if (!this.enabled) {
        console.warn(`[SendPulse] Email sending disabled. Skipping email to ${to}`);
        return { success: true }; // Non-blocking
      }

      const token = await this.getAccessToken();

      const payload = {
        email: {
          subject: "", // Subject comes from template
          from: {
            name: this.senderName,
            email: this.senderEmail,
          },
          to: [
            {
              email: to,
            },
          ],
          template: {
            id: templateId,
            variables: this.sanitizeVariables(variables),
          },
        },
      };

      const response = await fetch("https://api.sendpulse.com/mailing/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`SendPulse API error: ${response.statusText} - ${errorData}`);
      }

      const result = (await response.json()) as SendPulseEmailResponse;

      if (result.result?.status) {
        console.log(
          `[SendPulse] Email sent successfully to ${to} (Template: ${templateId})`
        );
        return { success: true };
      } else {
        console.error(
          `[SendPulse] API returned failure for ${to}:`,
          result
        );
        return { success: false, error: "API returned failure status" };
      }
    } catch (error) {
      // Non-blocking: log error but don't throw
      console.error(
        `[SendPulse] Failed to send email to ${to}:`,
        error instanceof Error ? error.message : String(error)
      );

      // Retry once on failure
      try {
        console.log(`[SendPulse] Retrying email to ${to}...`);
        this.accessToken = null; // Clear token to force refresh
        const token = await this.getAccessToken();

        const payload = {
          email: {
            subject: "",
            from: {
              name: this.senderName,
              email: this.senderEmail,
            },
            to: [
              {
                email: to,
              },
            ],
            template: {
              id: templateId,
              variables: this.sanitizeVariables(variables),
            },
          },
        };

        const retryResponse = await fetch("https://api.sendpulse.com/mailing/send", {
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
            console.log(`[SendPulse] Retry successful for ${to}`);
            return { success: true };
          }
        }
      } catch (retryError) {
        console.error(
          `[SendPulse] Retry failed for ${to}:`,
          retryError instanceof Error ? retryError.message : String(retryError)
        );
      }

      // Return success anyway - email failures should not block main flow
      return { success: true };
    }
  }

  /**
   * Send email to admin
   * Uses the same template system but sends to admin email from env
   */
  async sendAdminEmail(
    templateId: number,
    variables: EmailVariable
  ): Promise<{ success: boolean; error?: string }> {
    // For now, uses same implementation but admin email could be configured separately
    const adminEmail = process.env.ADMIN_EMAIL || "admin@askdetectives.com";
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

  // Profile & Account
  PROFILE_CLAIM_APPROVED: 4001, // Profile claim approved
  PROFILE_CLAIM_TEMPORARY_PASSWORD: 4002, // Temporary password for claimed profile
};
