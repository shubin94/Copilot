"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
async function analyzeRoutes() {
    console.log("🔍 DETAILED API ROUTES ANALYSIS\n");
    console.log("================================");
    console.log("Analyzing server/routes.ts");
    console.log("================================\n");
    const routesPath = path_1.default.join(process.cwd(), "server", "routes.ts");
    const content = fs_1.default.readFileSync(routesPath, "utf-8");
    const lines = content.split("\n");
    const routes = [];
    let lineNum = 1;
    // Parse for GET routes
    const getRoutePattern = /app\.get\s*\(\s*["'`]([^"'`]+)["'`]/g;
    const postRoutePattern = /app\.post\s*\(\s*["'`]([^"'`]+)["'`]/g;
    // Find all GET routes
    let match;
    const getRoutes = [];
    while ((match = getRoutePattern.exec(content)) !== null) {
        const path = match[1];
        const position = match.index;
        const lineAtPosition = content.substring(0, position).split("\n").length;
        getRoutes.push({
            path,
            lineNum: lineAtPosition,
            type: "GET",
        });
    }
    console.log(`Found ${getRoutes.length} GET endpoints\n`);
    // Analyze each route
    for (const route of getRoutes) {
        // Extract the route handler code block
        const startLine = route.lineNum - 1;
        let endLine = startLine;
        let braceCount = 0;
        let inHandler = false;
        for (let i = startLine; i < Math.min(startLine + 50, lines.length); i++) {
            const line = lines[i];
            if (line.includes("=>")) {
                inHandler = true;
            }
            if (inHandler) {
                for (const char of line) {
                    if (char === "{")
                        braceCount++;
                    if (char === "}")
                        braceCount--;
                }
                if (braceCount === 0 && inHandler) {
                    endLine = i;
                    break;
                }
            }
        }
        const handlerCode = lines.slice(startLine, Math.min(endLine + 1, lines.length)).join("\n");
        // Analyze the handler
        const hasSelectStar = handlerCode.includes("SELECT *");
        const hasLimit = handlerCode.includes("LIMIT");
        const isProtected = handlerCode.includes("requireAuth") ||
            handlerCode.includes("requireAdmin") ||
            handlerCode.includes("requireDetective");
        // Find SELECT patterns
        const selectMatch = handlerCode.match(/SELECT\s+([^FROM]+)/i);
        const selectFields = selectMatch ? selectMatch[1].trim() : "N/A";
        // Find JOINs
        const joins = [];
        if (handlerCode.includes("INNER JOIN"))
            joins.push("INNER JOIN");
        if (handlerCode.includes("LEFT JOIN"))
            joins.push("LEFT JOIN");
        if (handlerCode.includes("JOIN"))
            joins.push("JOIN");
        // Check caching
        let cacheStatus = "No cache";
        if (handlerCode.includes("Cache-Control") ||
            handlerCode.includes("cache.get") ||
            handlerCode.includes("cache.set")) {
            cacheStatus = "Cached (60s)";
        }
        else if (handlerCode.includes("public, max-age")) {
            const ageMatch = handlerCode.match(/max-age=(\d+)/);
            if (ageMatch) {
                cacheStatus = `Cached (${ageMatch[1]}s)`;
            }
        }
        // Estimate size based on pattern
        let estimatedSize = "5-10 KB";
        let riskLevel = "Low";
        if (route.path.includes("/api/detectives") &&
            !route.path.includes("/:id")) {
            estimatedSize = "50-200 KB";
            riskLevel = "High";
        }
        else if (route.path.includes("/api/services") &&
            !route.path.includes("/:id")) {
            estimatedSize = "80-300 KB";
            riskLevel = "High";
        }
        else if (route.path.includes("/api/admin")) {
            estimatedSize = "200-500 KB";
            riskLevel = "High";
        }
        else if (route.path.includes("/api/search")) {
            estimatedSize = "10-50 KB";
            riskLevel = "Medium";
        }
        else if (route.path.includes("sitemap")) {
            estimatedSize = "500 KB - 2 MB";
            riskLevel = "High";
        }
        else if (hasSelectStar) {
            estimatedSize = "50-200 KB";
            riskLevel = "Medium";
        }
        routes.push({
            method: "GET",
            path: route.path,
            lineNumber: route.lineNum,
            selectFields,
            hasSelectStar,
            hasLimit,
            isProtected,
            joins,
            cacheStatus,
            estimatedSize,
            riskLevel,
        });
    }
    // Sort by risk level
    routes.sort((a, b) => {
        const riskOrder = { High: 0, Medium: 1, Low: 2 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
    console.log("📊 HIGH-RISK ENDPOINTS:\n");
    const highRisk = routes.filter((r) => r.riskLevel === "High");
    for (const route of highRisk.slice(0, 10)) {
        console.log(`⚠️  ${route.path}`);
        console.log(`   Type: ${route.method} | Line: ${route.lineNumber}`);
        console.log(`   Size: ${route.estimatedSize} per request`);
        console.log(`   Cache: ${route.cacheStatus}`);
        console.log(`   Issues: ${route.hasSelectStar ? "SELECT * | " : ""}${route.hasLimit ? "" : "No LIMIT | "}${route.joins.length > 0 ? `${route.joins.length} JOIN operations` : ""}`);
        console.log();
    }
    console.log("\n📋 MEDIUM-RISK ENDPOINTS:\n");
    const mediumRisk = routes.filter((r) => r.riskLevel === "Medium");
    for (const route of mediumRisk.slice(0, 5)) {
        console.log(`🟡 ${route.path}`);
        console.log(`   Size: ${route.estimatedSize}`);
        console.log(`   Cache: ${route.cacheStatus}`);
        console.log();
    }
    console.log("\n✅ LOW-RISK ENDPOINTS: " + routes.filter((r) => r.riskLevel === "Low").length);
    // Generate summary statistics
    const summary = {
        totalEndpoints: routes.length,
        highRisk: routes.filter((r) => r.riskLevel === "High").length,
        mediumRisk: routes.filter((r) => r.riskLevel === "Medium").length,
        lowRisk: routes.filter((r) => r.riskLevel === "Low").length,
        withSelectStar: routes.filter((r) => r.hasSelectStar).length,
        withoutLimit: routes.filter((r) => !r.hasLimit).length,
        cached: routes.filter((r) => r.cacheStatus !== "No cache").length,
        protected: routes.filter((r) => r.isProtected).length,
    };
    console.log("\n════════════════════════════════════");
    console.log("📈 SUMMARY STATISTICS");
    console.log("════════════════════════════════════\n");
    console.log(`Total Endpoints: ${summary.totalEndpoints}`);
    console.log(`Risk Distribution: ${summary.highRisk} HIGH | ${summary.mediumRisk} MEDIUM | ${summary.lowRisk} LOW`);
    console.log(`SELECT * Patterns: ${summary.withSelectStar} endpoints (${((summary.withSelectStar / summary.totalEndpoints) * 100).toFixed(1)}%)`);
    console.log(`Missing LIMIT clause: ${summary.withoutLimit} endpoints (${((summary.withoutLimit / summary.totalEndpoints) * 100).toFixed(1)}%)`);
    console.log(`With Caching: ${summary.cached} endpoints (${((summary.cached / summary.totalEndpoints) * 100).toFixed(1)}%)`);
    console.log(`Protected Endpoints: ${summary.protected} endpoints (${((summary.protected / summary.totalEndpoints) * 100).toFixed(1)}%)`);
    // Save to JSON
    fs_1.default.writeFileSync("api-routes-audit.json", JSON.stringify({
        timestamp: new Date().toISOString(),
        summary,
        routes: routes.sort((a, b) => {
            const riskOrder = { High: 0, Medium: 1, Low: 2 };
            return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }),
    }, null, 2));
    console.log("\n✅ Detailed report saved to api-routes-audit.json");
}
analyzeRoutes().catch(console.error);
