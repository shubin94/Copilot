import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PUBLIC_DIR = path.resolve(__dirname, "..", "dist", "public");
const ASSETS_DIR = path.join(DIST_PUBLIC_DIR, "assets");

const KB = 1024;

const budgets = {
  maxLargestJsKb: 300,
  maxLargestCssKb: 130,
  maxTotalJsKb: 1500,
  maxTotalCssKb: 300,
  maxAssetCount: 120,
};

interface SizedAsset {
  name: string;
  size: number;
}

function formatKb(bytes: number): string {
  return `${(bytes / KB).toFixed(2)} KB`;
}

async function getAssetsByExtension(dirPath: string, extension: string): Promise<SizedAsset[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results: SizedAsset[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(extension)) continue;

    const fullPath = path.join(dirPath, entry.name);
    const stat = await fs.stat(fullPath);
    results.push({ name: entry.name, size: stat.size });
  }

  return results.sort((a, b) => b.size - a.size);
}

async function main() {
  try {
    const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
    const assetCount = entries.filter((entry) => entry.isFile()).length;

    const jsAssets = await getAssetsByExtension(ASSETS_DIR, ".js");
    const cssAssets = await getAssetsByExtension(ASSETS_DIR, ".css");

    const totalJs = jsAssets.reduce((sum, file) => sum + file.size, 0);
    const totalCss = cssAssets.reduce((sum, file) => sum + file.size, 0);
    const largestJs = jsAssets[0]?.size ?? 0;
    const largestCss = cssAssets[0]?.size ?? 0;

    const failures: string[] = [];

    if (largestJs > budgets.maxLargestJsKb * KB) {
      failures.push(`Largest JS chunk ${formatKb(largestJs)} exceeds ${budgets.maxLargestJsKb} KB`);
    }

    if (largestCss > budgets.maxLargestCssKb * KB) {
      failures.push(`Largest CSS chunk ${formatKb(largestCss)} exceeds ${budgets.maxLargestCssKb} KB`);
    }

    if (totalJs > budgets.maxTotalJsKb * KB) {
      failures.push(`Total JS ${formatKb(totalJs)} exceeds ${budgets.maxTotalJsKb} KB`);
    }

    if (totalCss > budgets.maxTotalCssKb * KB) {
      failures.push(`Total CSS ${formatKb(totalCss)} exceeds ${budgets.maxTotalCssKb} KB`);
    }

    if (assetCount > budgets.maxAssetCount) {
      failures.push(`Asset count ${assetCount} exceeds ${budgets.maxAssetCount}`);
    }

    console.log("📊 Performance Budget Report");
    console.log(`- Assets: ${assetCount}`);
    console.log(`- Largest JS: ${formatKb(largestJs)} (${jsAssets[0]?.name ?? "n/a"})`);
    console.log(`- Largest CSS: ${formatKb(largestCss)} (${cssAssets[0]?.name ?? "n/a"})`);
    console.log(`- Total JS: ${formatKb(totalJs)}`);
    console.log(`- Total CSS: ${formatKb(totalCss)}`);

    if (failures.length > 0) {
      console.error("\n❌ Performance budget check failed:");
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }
      process.exit(1);
    }

    console.log("\n✅ Performance budgets passed");
  } catch (error) {
    console.error("❌ Failed to run performance budget check:", error);
    process.exit(1);
  }
}

main();
