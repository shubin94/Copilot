#!/usr/bin/env node
import { db } from "./db/index.ts";
import { emailTemplates } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function showTemplate() {
  const template = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.key, "EMAIL_VERIFICATION"))
    .limit(1)
    .then(r => r[0]);

  console.log("EMAIL_VERIFICATION Template:");
  console.log("============================\n");
  console.log("Key:", template.key);
  console.log("Name:", template.name);
  console.log("SendPulse ID:", template.sendpulseTemplateId);
  console.log("Active:", template.isActive);
  console.log("\nSUBJECT:");
  console.log(template.subject);
  console.log("\nBODY:");
  console.log(template.body);
  console.log("\n\n");
  console.log("EXACT PAYLOAD BEING SENT TO SENDPULSE:");
  console.log("=======================================");
  console.log(JSON.stringify({
    email: {
      subject: "",
      from: {
        name: "Ask Detectives",
        email: "contact@askdetectives.com"
      },
      to: [{ email: "contact@askdetectives.com" }],
      template: {
        id: template.sendpulseTemplateId,
        variables: {
          userName: "Changappa A K",
          verificationLink: "http://localhost:5000/auth/verify-email?token=test123"
        }
      }
    }
  }, null, 2));
}

showTemplate();
