import "../server/lib/loadEnv";
import nodemailer from "nodemailer";
import { loadSecretsFromDatabase } from "../server/lib/secretsLoader.ts";
import { config } from "../server/config.ts";

async function main() {
  await loadSecretsFromDatabase();

  const host = config.email.smtpHost;
  const port = config.email.smtpPort ?? 587;
  const secure = config.email.smtpSecure || port === 465;
  const user = config.email.smtpUser;
  const pass = config.email.smtpPass;
  const fromEmail = config.email.smtpFromEmail;
  const toEmail = process.argv[2] || fromEmail;

  console.log("SMTP config check:");
  console.log(`  host: ${host ? "SET" : "MISSING"}`);
  console.log(`  port: ${port}`);
  console.log(`  secure: ${secure}`);
  console.log(`  user: ${user ? "SET" : "MISSING"}`);
  console.log(`  pass: ${pass ? "SET" : "MISSING"}`);
  console.log(`  from: ${fromEmail || "MISSING"}`);
  console.log(`  to: ${toEmail || "MISSING"}`);

  if (!host) throw new Error("SMTP_HOST not configured");
  if (!fromEmail) throw new Error("SMTP_FROM_EMAIL not configured");
  if (!toEmail) throw new Error("Recipient email missing");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  } as any);

  const result = await transporter.sendMail({
    from: { address: fromEmail, name: "AskDetectives" } as any,
    to: toEmail,
    subject: "SMTP Test Email",
    text: "This is a test email sent via SMTP configuration.",
  });

  console.log("\nSMTP test send complete:");
  console.log(`  messageId: ${result.messageId || "(none)"}`);
}

main().catch((error) => {
  console.error("SMTP test failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
