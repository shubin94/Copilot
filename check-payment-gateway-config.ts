import { pool } from "./db/index.ts";

function mask(value: string | null | undefined) {
  if (!value) return "(empty)";
  const v = String(value);
  if (v.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}

async function run() {
  const result = await pool.query(
    "SELECT id, name, display_name, is_enabled, is_test_mode, config FROM payment_gateways ORDER BY name"
  );
  console.log(`Gateways: ${result.rows.length}`);
  for (const row of result.rows) {
    const cfg = row.config || {};
    const summary: Record<string, string> = {};
    if (row.name === "razorpay") {
      summary.keyId = mask(cfg.keyId);
      summary.keySecret = mask(cfg.keySecret);
    }
    if (row.name === "paypal") {
      summary.clientId = mask(cfg.clientId);
      summary.clientSecret = mask(cfg.clientSecret);
      summary.mode = cfg.mode || "(unset)";
    }
    console.log(`${row.name} enabled=${row.is_enabled} test=${row.is_test_mode} config=${JSON.stringify(summary)}`);
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
