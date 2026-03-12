import "../server/lib/loadEnv.js";
import { pool } from "../db/index.js";
import { formatLocationIntegrityReport, runLocationIntegrityCheck } from "../server/lib/location-integrity-check.js";

async function run() {
  const strict = process.argv.includes("--strict");
  const light = process.argv.includes("--light");
  const report = await runLocationIntegrityCheck({
    mode: light ? "light" : "full",
  });

  console.log(formatLocationIntegrityReport(report));

  if (strict && !report.ok) {
    process.exitCode = 1;
  }
  if (!strict && report.hasCritical) {
    process.exitCode = 1;
  }
}

run()
  .catch((error) => {
    console.error("[Location Integrity] Audit script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
