import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const targetDirs = ["server", "api"];
const sourceFileExt = new Set([".ts", ".tsx"]);

function walk(dirPath, results = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!sourceFileExt.has(path.extname(entry.name))) continue;
    results.push(fullPath);
  }
  return results;
}

const importRegex = /^\s*import\s+(?:.+?\s+from\s+)?["']([^"']+)["'];?/gm;
const issues = [];

for (const relDir of targetDirs) {
  const absDir = path.join(projectRoot, relDir);
  if (!fs.existsSync(absDir)) continue;

  const files = walk(absDir);
  for (const filePath of files) {
    const relPath = path.relative(projectRoot, filePath).replaceAll("\\", "/");
    const content = fs.readFileSync(filePath, "utf8");

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const specifier = match[1];

      if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        continue;
      }

      const line = content.slice(0, match.index).split(/\r?\n/).length;

      if (specifier.includes("client/src")) {
        issues.push({
          relPath,
          line,
          specifier,
          reason: "Backend runtime import must not reference client/src",
        });
        continue;
      }

      const ext = path.extname(specifier);
      if (ext === "") {
        issues.push({
          relPath,
          line,
          specifier,
          reason: "Local runtime import is missing explicit extension",
        });
        continue;
      }

      if (ext === ".ts" || ext === ".tsx") {
        issues.push({
          relPath,
          line,
          specifier,
          reason: "Runtime import must use .js, not .ts/.tsx",
        });
      }
    }
  }
}

if (issues.length === 0) {
  console.log("✅ Backend runtime import verification passed.");
  process.exit(0);
}

console.error("❌ Backend runtime import verification failed:\n");
for (const issue of issues) {
  console.error(`- ${issue.relPath}:${issue.line} -> ${issue.specifier}`);
  console.error(`  ${issue.reason}`);
}

process.exit(1);
