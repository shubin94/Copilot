import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

async function run() {
  const dir = path.resolve(import.meta.dirname, "..", "attached_assets", "generated_images");
  const files = await fs.promises.readdir(dir);
  for (const f of files) {
    if (f.toLowerCase().endsWith(".png")) {
      const src = path.join(dir, f);
      const dest = src.slice(0, -4) + ".webp";
      try {
        const buf = await fs.promises.readFile(src);
        const img = sharp(buf);
        await img.webp({ quality: 80 }).toFile(dest);
      } catch {
      }
    }
  }
}

run();
