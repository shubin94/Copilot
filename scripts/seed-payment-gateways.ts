/**
 * Seed payment_gateways with PayPal and Razorpay so they appear on Admin → Payment Gateways.
 * Credentials are stored in App Secrets; this only creates the rows for enable/disable and test mode.
 * Run once: npm run db:seed-payment-gateways
 */
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("supabase") || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: process.env.NODE_ENV === "production" }
      : undefined,
  });

  const gateways = [
    { name: "razorpay", display_name: "Razorpay", config: { keyId: "", keySecret: "", webhookSecret: "" } },
    { name: "paypal", display_name: "PayPal", config: { clientId: "", clientSecret: "", mode: "sandbox" } },
  ];

  try {
    for (const gw of gateways) {
      await pool.query(
        `INSERT INTO payment_gateways (name, display_name, is_enabled, is_test_mode, config)
         VALUES ($1, $2, false, true, $3::jsonb)
         ON CONFLICT (name) DO NOTHING`,
        [gw.name, gw.display_name, JSON.stringify(gw.config)]
      );
    }
    console.log("✅ Payment gateways (PayPal, Razorpay) are seeded. Refresh Admin → Payment Gateways.");
  } catch (e: any) {
    if (e?.code === "42P01") {
      console.error("Table payment_gateways does not exist. Run migration 0020_add_payment_gateways.sql first.");
    } else {
      console.error(e);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
