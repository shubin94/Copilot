import { config } from "./config.ts";
import nodemailer from "nodemailer";

type EmailContent = {
  subject: string;
  text: string;
  html?: string;
};

async function sendViaSendGrid(to: string, content: EmailContent): Promise<void> {
  const apiKey = config.email.sendgridApiKey;
  const fromEmail = config.email.sendgridFromEmail;
  if (!apiKey) throw new Error("SENDGRID_API_KEY not configured (Admin → App Secrets)");
  if (!fromEmail) throw new Error("SENDGRID_FROM_EMAIL not configured (Admin → App Secrets)");

  const payload = {
    personalizations: [{ to: [{ email: to }], subject: content.subject }],
    from: { email: fromEmail, name: "FindDetectives" },
    content: [
      content.html
        ? { type: "text/html", value: content.html }
        : { type: "text/plain", value: content.text },
    ],
  };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${body}`);
  }
}

async function sendViaSMTP(to: string, content: EmailContent): Promise<void> {
  const host = config.email.smtpHost;
  const port = config.email.smtpPort ?? 587;
  const secure = config.email.smtpSecure || port === 465;
  const user = config.email.smtpUser;
  const pass = config.email.smtpPass;
  const fromEmail = config.email.smtpFromEmail || config.email.sendgridFromEmail;

  if (!host) throw new Error("SMTP_HOST not configured");
  if (!fromEmail) throw new Error("SMTP_FROM_EMAIL not configured");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  } as any);

  await transporter.sendMail({
    from: { address: fromEmail, name: "FindDetectives" } as any,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

async function sendFallback(to: string, content: EmailContent): Promise<void> {
  console.log(`[Email Fallback] To: ${to}`);
  console.log(`Subject: ${content.subject}`);
  console.log(content.text);
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  try {
    if (config.email.sendgridApiKey) {
      await sendViaSendGrid(to, content);
    } else if (config.email.smtpHost) {
      await sendViaSMTP(to, content);
    } else {
      if (config.env.isProd) {
        throw new Error("Email not configured");
      } else {
        await sendFallback(to, content);
      }
    }
  } catch (err) {
    console.error("Email send error:", err);
    if (config.env.isProd) throw err;
  }
}

export async function sendClaimApprovedEmail(params: {
  to: string;
  detectiveName: string;
  wasNewUser: boolean;
  temporaryPassword?: string;
}): Promise<void> {
  const { to, detectiveName, wasNewUser, temporaryPassword } = params;

  const subject = wasNewUser
    ? "Your detective profile has been claimed — account created"
    : "Your detective profile has been claimed — access granted";

  const text = buildClaimApprovedText({ detectiveName, wasNewUser, temporaryPassword });
  const html = buildClaimApprovedHtml({ detectiveName, wasNewUser, temporaryPassword });
  await sendEmail(to, { subject, text, html });
}

function buildClaimApprovedText({ detectiveName, wasNewUser, temporaryPassword }: { detectiveName: string; wasNewUser: boolean; temporaryPassword?: string }) {
  const lines: string[] = [];
  lines.push("Hello,");
  lines.push("");
  lines.push(`You now own the detective profile: ${detectiveName}.`);
  lines.push("");
  if (wasNewUser && temporaryPassword) {
    lines.push("We created an account for you.");
    lines.push("Login using your email address and the temporary password below:");
    lines.push("");
    lines.push(`Temporary password: ${temporaryPassword}`);
    lines.push("");
    lines.push("For security, please reset your password immediately after logging in.");
  } else {
    lines.push("Please log out and back in to see your detective dashboard if you are already signed in.");
  }
  lines.push("");
  lines.push("If you have any questions, reply to this email.");
  lines.push("");
  lines.push("— FindDetectives Team");
  return lines.join("\n");
}

function buildClaimApprovedHtml({ detectiveName, wasNewUser, temporaryPassword }: { detectiveName: string; wasNewUser: boolean; temporaryPassword?: string }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f7f7f7;padding:24px;color:#111">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px">
      <div style="padding:20px;border-bottom:1px solid #e5e7eb">
        <h1 style="margin:0;font-size:18px;color:#16a34a">FindDetectives</h1>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 12px 0">Hello,</p>
        <p style="margin:0 0 12px 0">You now own the detective profile: <strong>${escapeHtml(detectiveName)}</strong>.</p>
        ${wasNewUser && temporaryPassword ? `
          <div style="margin:16px 0;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px">
            <p style="margin:0 0 8px 0;color:#166534;font-weight:bold">Your account has been created</p>
            <p style="margin:0 0 8px 0;color:#166534">Use the temporary password below to log in:</p>
            <div style="font-family:monospace;background:#ffffff;border:1px dashed #86efac;padding:10px;border-radius:4px;color:#111">${escapeHtml(temporaryPassword!)}</div>
            <p style="margin:12px 0 0 0;color:#166534">For security, please reset your password immediately after logging in.</p>
          </div>
        ` : `
          <p style="margin:0 0 12px 0">If you are already signed in, please log out and back in to access your detective dashboard.</p>
        `}
        <p style="margin:16px 0">If you have any questions, reply to this email.</p>
        <p style="margin:0;color:#6b7280">— FindDetectives Team</p>
      </div>
    </div>
    <p style="text-align:center;margin-top:16px;color:#6b7280;font-size:12px">This is an automated message from FindDetectives</p>
  </div>`;
}

function escapeHtml(str: string) {
  return str.replace(/[&<>"]+/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
