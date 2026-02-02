import { pool } from "../../db/index.ts";
import { config } from "../config.ts";

async function seedPaymentGateways() {
  const existing = await pool.query(
    "SELECT name FROM payment_gateways ORDER BY name"
  );
  const existingNames = new Set(existing.rows.map((r: any) => r.name));

  const razorpayHasKeys = Boolean(config.razorpay.keyId && config.razorpay.keySecret);
  const paypalHasKeys = Boolean(config.paypal.clientId && config.paypal.clientSecret);

  const gateways = [
    {
      name: "razorpay",
      display_name: "Razorpay",
      is_enabled: razorpayHasKeys,
      is_test_mode: true,
      config: {
        keyId: config.razorpay.keyId || "",
        keySecret: config.razorpay.keySecret || "",
      },
    },
    {
      name: "paypal",
      display_name: "PayPal",
      is_enabled: paypalHasKeys,
      is_test_mode: (config.paypal.mode || "sandbox") !== "live",
      config: {
        clientId: config.paypal.clientId || "",
        clientSecret: config.paypal.clientSecret || "",
        mode: config.paypal.mode || "sandbox",
      },
    },
  ];

  for (const gw of gateways) {
    if (existingNames.has(gw.name)) continue;
    await pool.query(
      `INSERT INTO payment_gateways (name, display_name, is_enabled, is_test_mode, config)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [gw.name, gw.display_name, gw.is_enabled, gw.is_test_mode, JSON.stringify(gw.config)]
    );
  }

  const final = await pool.query(
    "SELECT name, display_name, is_enabled, is_test_mode FROM payment_gateways ORDER BY name"
  );
  console.log("Seeded payment gateways:");
  final.rows.forEach((r: any) => {
    console.log(`${r.name} (${r.display_name}) enabled=${r.is_enabled} test=${r.is_test_mode}`);
  });
}

seedPaymentGateways()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
