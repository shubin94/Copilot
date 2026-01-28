import { db } from "./db/index.ts";
import { emailTemplates } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function updateTemplate() {
  console.log("📝 Updating SIGNUP_WELCOME template ID to 70568...\n");

  try {
    const result = await db
      .update(emailTemplates)
      .set({ sendpulseTemplateId: 70568 })
      .where(eq(emailTemplates.key, "SIGNUP_WELCOME"))
      .returning();

    if (result.length > 0) {
      console.log("✅ Template updated successfully!");
      console.log(`   Template: ${result[0].name}`);
      console.log(`   Key: ${result[0].key}`);
      console.log(`   SendPulse ID: ${result[0].sendpulseTemplateId}\n`);
    } else {
      console.log("⚠️  No template found with key SIGNUP_WELCOME");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating template:", error);
    process.exit(1);
  }
}

updateTemplate();
