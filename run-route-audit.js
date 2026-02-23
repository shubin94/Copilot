import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("🔍 DETAILED API ROUTES ANALYSIS\n");
console.log("================================");
console.log("Analyzing server/routes.ts");
console.log("================================\n");

const routesPath = path.join(__dirname, "server", "routes.ts");
const content = fs.readFileSync(routesPath, "utf-8");

// Get all app.get patterns
const getPattern = /app\.get\s*\(\s*['"`]([^'"`]+)['"`]/g;
const matches = [...content.matchAll(getPattern)];

console.log(`Found ${matches.length} GET endpoints\n`);

// Group by risk
const endpoints = matches.map((m) => {
  const pathStr = m[1];
  let risk = "Low";
  let size = "5-10 KB";

  if (pathStr.includes("/api/detectives") && !pathStr.includes(":id")) {
    risk = "High";
    size = "50-200 KB";
  } else if (
    pathStr.includes("/api/services") &&
    !pathStr.includes(":id")
  ) {
    risk = "High";
    size = "80-300 KB";
  } else if (pathStr.includes("/api/admin")) {
    risk = "High";
    size = "200-500 KB";
  } else if (pathStr.includes("sitemap")) {
    risk = "High";
    size = "500KB-2MB";
  } else if (pathStr.includes("/api/search")) {
    risk = "Medium";
    size = "10-50 KB";
  }

  return { path: pathStr, risk, size };
});

const high = endpoints.filter((e) => e.risk === "High");
const medium = endpoints.filter((e) => e.risk === "Medium");
const low = endpoints.filter((e) => e.risk === "Low");

console.log("⚠️  HIGH-RISK ENDPOINTS:\n");
high.forEach((e) => console.log(`  ${e.path} (${e.size})`));

console.log(`\n🟡 MEDIUM-RISK ENDPOINTS: ${medium.length}`);
medium.slice(0, 5).forEach((e) => console.log(`  ${e.path}`));

console.log(`\n✅ LOW-RISK ENDPOINTS: ${low.length}`);

console.log(`\n════════════════════════════════════`);
console.log(`Total GET Endpoints: ${endpoints.length}`);
console.log(`Risk Distribution: ${high.length} HIGH | ${medium.length} MEDIUM | ${low.length} LOW`);
console.log(`════════════════════════════════════\n`);

// Save to JSON
fs.writeFileSync(
  "api-routes-audit.json",
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      summary: {
        totalEndpoints: endpoints.length,
        highRisk: high.length,
        mediumRisk: medium.length,
        lowRisk: low.length,
      },
      highRiskEndpoints: high,
      mediumRiskEndpoints: medium,
    },
    null,
    2
  )
);

console.log("✅ Report saved to api-routes-audit.json");
