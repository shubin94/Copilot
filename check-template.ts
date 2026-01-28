#!/usr/bin/env node
/**
 * Check PASSWORD_RESET template in database
 */

import { db } from "./db/index.ts";
import { emailTemplates } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function checkTemplate() {
  try {
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, "PASSWORD_RESET"))
      .limit(1)
      .then(r => r[0]);

    console.log("PASSWORD_RESET Template in Database:");
    console.log("=====================================");
    console.log("Key:", template.key);
    console.log("Name:", template.name);
    console.log("SendPulse ID:", template.sendpulseTemplateId);
    console.log("\nYour SendPulse Template ID from screenshot: 70578");
    
    if (template.sendpulseTemplateId === 70578) {
      console.log("\n✅ IDs MATCH! Database is correct.");
    } else {
      console.log(`\n❌ IDs DO NOT MATCH!`);
      console.log(`   Database has: ${template.sendpulseTemplateId}`);
      console.log(`   SendPulse has: 70578`);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

checkTemplate();
