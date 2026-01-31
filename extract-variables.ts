#!/usr/bin/env node
/**
 * Extract exact template variables from database
 * These are the exact variables defined in the admin page
 */

import { db } from "./db/index.ts";
import { emailTemplates } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function extractVariables() {
  const template = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.key, "PASSWORD_RESET"))
    .limit(1)
    .then(r => r[0]);

  console.log("PASSWORD_RESET Template from Database:");
  console.log("=====================================\n");
  
  console.log("KEY:", template.key);
  console.log("NAME:", template.name);
  console.log("SENDPULSE ID:", template.sendpulseTemplateId);
  console.log("");

  console.log("SUBJECT:");
  console.log(template.subject);
  console.log("");

  console.log("BODY:");
  console.log(template.body);
  console.log("");

  // Extract variables from body
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;
  
  while ((match = variableRegex.exec(template.body)) !== null) {
    variables.add(match[1]);
  }

  // Also check subject
  variableRegex.lastIndex = 0;
  while ((match = variableRegex.exec(template.subject)) !== null) {
    variables.add(match[1]);
  }

  console.log("EXTRACTED VARIABLES:");
  console.log("===================");
  Array.from(variables).sort().forEach(v => {
    console.log(`  - ${v}`);
  });
  
  console.log("\n✅ Use EXACTLY these variables when sending emails");
}

extractVariables();
