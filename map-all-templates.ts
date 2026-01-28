#!/usr/bin/env node
/**
 * Comprehensive Template Variable Mapper
 * Extracts EXACT variables from all templates
 * Creates a mapping for correct variable names per template
 */

import { db } from "./db/index.ts";
import { emailTemplates } from "./shared/schema.ts";

async function mapAllTemplateVariables() {
  console.log("🔍 ANALYZING ALL EMAIL TEMPLATES");
  console.log("=".repeat(80));
  console.log("");

  const templates = await db.select().from(emailTemplates);
  const mapping: Record<string, { variables: string[]; subject: string; body: string }> = {};

  templates.forEach((template) => {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;

    // Extract from subject
    let tempRegex = new RegExp(variableRegex.source, "g");
    while ((match = tempRegex.exec(template.subject)) !== null) {
      variables.add(match[1]);
    }

    // Extract from body
    tempRegex = new RegExp(variableRegex.source, "g");
    while ((match = tempRegex.exec(template.body)) !== null) {
      variables.add(match[1]);
    }

    const variablesArray = Array.from(variables).sort();
    mapping[template.key] = {
      variables: variablesArray,
      subject: template.subject,
      body: template.body,
    };

    console.log(`📧 ${template.name}`);
    console.log(`   Key: ${template.key}`);
    console.log(`   SendPulse ID: ${template.sendpulseTemplateId || "NOT SET"}`);
    console.log(`   Variables: ${variablesArray.length > 0 ? variablesArray.join(", ") : "NONE"}`);
    console.log("");
  });

  // Create TypeScript type definition
  console.log("\n" + "=".repeat(80));
  console.log("📝 TYPESCRIPT VARIABLE MAPPING");
  console.log("=".repeat(80));
  console.log("");

  console.log("export const TEMPLATE_VARIABLES = {");
  Object.entries(mapping).forEach(([key, data]) => {
    console.log(`  ${key}: {`);
    console.log(`    variables: [${data.variables.map((v) => `"${v}"`).join(", ")}],`);
    console.log(`  },`);
  });
  console.log("} as const;");

  console.log("\n" + "=".repeat(80));
  console.log("📋 JSON MAPPING FOR REFERENCE");
  console.log("=".repeat(80));
  console.log("");
  console.log(JSON.stringify(mapping, null, 2));

  // Save to file
  const fs = await import("fs");
  fs.writeFileSync(
    "TEMPLATE_VARIABLES.json",
    JSON.stringify(mapping, null, 2)
  );

  console.log("\n✅ Saved to TEMPLATE_VARIABLES.json");
}

mapAllTemplateVariables();
