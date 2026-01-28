/**
 * Email Template Service
 * Resolves email templates from database by key
 * Provides centralized management of all email content
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { emailTemplates } from "../../shared/schema";
import type { EmailTemplate } from "../../shared/schema";

export interface EmailTemplateResolved {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  sendpulseTemplateId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolve email template by key
 * Returns template data if active, null if not found or disabled
 */
export async function getEmailTemplate(key: string): Promise<EmailTemplateResolved | null> {
  try {
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, key))
      .limit(1)
      .then((r: EmailTemplate[]) => r[0]);

    if (!template) {
      console.warn(`[Email] Template not found: ${key}`);
      return null;
    }

    if (!template.isActive) {
      console.warn(`[Email] Template is disabled: ${key}`);
      return null;
    }

    return template;
  } catch (error) {
    console.error(`[Email] Error resolving template ${key}:`, error);
    return null;
  }
}

/**
 * Get all email templates (for admin)
 */
export async function getAllEmailTemplates(): Promise<EmailTemplateResolved[]> {
  try {
    const templates = await db
      .select()
      .from(emailTemplates)
      .orderBy(emailTemplates.createdAt);

    return templates;
  } catch (error) {
    console.error("[Email] Error fetching all templates:", error);
    return [];
  }
}

/**
 * Update email template
 */
export async function updateEmailTemplate(
  key: string,
  data: {
    name?: string;
    description?: string;
    subject?: string;
    body?: string;
    sendpulseTemplateId?: number | null;
    isActive?: boolean;
  }
): Promise<EmailTemplateResolved | null> {
  try {
    const template = await db
      .update(emailTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.key, key))
      .returning();

    if (!template[0]) {
      console.warn(`[Email] Template not found for update: ${key}`);
      return null;
    }

    return template[0];
  } catch (error) {
    console.error(`[Email] Error updating template ${key}:`, error);
    return null;
  }
}

/**
 * Toggle template active status
 */
export async function toggleEmailTemplate(key: string): Promise<EmailTemplateResolved | null> {
  try {
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, key))
      .limit(1)
      .then((r: EmailTemplate[]) => r[0]);

    if (!template) {
      console.warn(`[Email] Template not found for toggle: ${key}`);
      return null;
    }

    const updated = await db
      .update(emailTemplates)
      .set({
        isActive: !template.isActive,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.key, key))
      .returning();

    return updated[0];
  } catch (error) {
    console.error(`[Email] Error toggling template ${key}:`, error);
    return null;
  }
}

/**
 * Extract variables from template
 * Looks for {{variableName}} patterns
 */
export function extractTemplateVariables(templateBody: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = regex.exec(templateBody)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables).sort();
}
