/**
 * Email Template Variables Mapping
 * 
 * This file defines the EXACT variables required for each email template.
 * These are extracted from the database and must match SendPulse templates exactly.
 */

export const TEMPLATE_VARIABLES = {
  DETECTIVE_APPLICATION_SUBMITTED: {
    variables: ["businessName", "country", "detectiveName", "submittedAt"],
  },
  DETECTIVE_APPLICATION_APPROVED: {
    variables: ["dashboardUrl", "detectiveName", "loginUrl", "supportEmail"],
  },
  DETECTIVE_APPLICATION_REJECTED: {
    variables: ["detectiveName", "rejectionReason", "supportEmail"],
  },
  CLAIMABLE_ACCOUNT_INVITATION: {
    variables: ["claimLink", "detectiveName"],
  },
  CLAIMABLE_ACCOUNT_CREDENTIALS: {
    variables: ["detectiveName", "loginEmail", "loginUrl", "supportEmail", "tempPassword"],
  },
  CLAIMABLE_ACCOUNT_FINALIZED: {
    variables: ["detectiveName", "loginEmail", "loginUrl", "supportEmail"],
  },
  SUBSCRIPTION_ACTIVATED: {
    variables: ["billingCycle", "detectiveName", "expiresAt", "features", "planName", "subscriptionUrl"],
  },
  SUBSCRIPTION_EXPIRED: {
    variables: ["detectiveName", "expiredAt", "planName", "renewUrl", "supportEmail"],
  },
  SUBSCRIPTION_RENEWING_SOON: {
    variables: ["amount", "detectiveName", "planName", "renewsAt", "subscriptionUrl"],
  },
  PAYMENT_SUCCESS: {
    variables: ["amount", "detectiveName", "paymentDate", "planName", "receiptUrl", "transactionId"],
  },
  PAYMENT_FAILURE: {
    variables: ["amount", "detectiveName", "failureReason", "paymentUrl", "supportEmail"],
  },
  BLUE_TICK_PURCHASE: {
    variables: ["activatedAt", "amount", "detectiveName", "profileUrl"],
  },
  ADMIN_NEW_SIGNUP: {
    variables: ["businessName", "country", "detectiveName", "email", "reviewUrl", "submittedAt"],
  },
  SIGNUP_WELCOME: {
    variables: ["loginUrl", "supportEmail", "userName"],
  },
  EMAIL_VERIFICATION: {
    variables: ["userName", "verificationLink"],
  },
  PASSWORD_RESET: {
    variables: ["resetLink", "userName"],
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATE_VARIABLES;

/**
 * Validate that the provided variables match the template requirements
 */
export function validateTemplateVariables(
  templateKey: TemplateKey,
  variables: Record<string, any>
): { valid: boolean; missing: string[]; extra: string[] } {
  const required = TEMPLATE_VARIABLES[templateKey]?.variables || [];
  const provided = Object.keys(variables);

  const missing = required.filter((v) => !(v in variables));
  const extra = provided.filter((v) => !required.includes(v));

  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

/**
 * Filter and return only the required variables for a template
 */
export function getRequiredVariables(
  templateKey: TemplateKey,
  variables: Record<string, any>
): Record<string, any> {
  const required = TEMPLATE_VARIABLES[templateKey]?.variables || [];
  const filtered: Record<string, any> = {};

  required.forEach((key) => {
    if (key in variables) {
      filtered[key] = variables[key];
    }
  });

  return filtered;
}
