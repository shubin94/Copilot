import { pool } from "./db/index.ts";

async function checkPaymentGateways() {
  const result = await pool.query(`SELECT id, name, display_name, is_enabled, is_test_mode FROM payment_gateways ORDER BY name`);
  console.log(`Total gateways: ${result.rows.length}`);
  result.rows.forEach((g: any) => {
    console.log(`${g.name} (${g.display_name}) enabled=${g.is_enabled} test=${g.is_test_mode}`);
  });
  const enabled = result.rows.filter((g: any) => g.is_enabled);
  console.log(`Enabled gateways: ${enabled.length}`);
  process.exit(0);
}

checkPaymentGateways().catch((e) => {
  console.error(e);
  process.exit(1);
});
