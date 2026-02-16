import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEO_PRERENDER_TEMPLATES } from "../server/lib/spa-route-manifest.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_PUBLIC_DIR = path.resolve(__dirname, "..", "dist", "public");
const BASE_URL = "https://www.askdetectives.com";

function upsertMetaTag(html: string, key: string, content: string, byProperty = false): string {
  const attr = byProperty ? "property" : "name";
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta\\s+${attr}=["']${escaped}["'][^>]*>`, "i");
  const nextTag = `<meta ${attr}="${key}" content="${content}">`;

  if (regex.test(html)) {
    return html.replace(regex, nextTag);
  }

  return html.replace("</head>", `  ${nextTag}\n</head>`);
}

function upsertCanonical(html: string, canonicalUrl: string): string {
  const regex = /<link\s+rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${canonicalUrl}">`;

  if (regex.test(html)) {
    return html.replace(regex, tag);
  }

  return html.replace("</head>", `  ${tag}\n</head>`);
}

function withTitle(html: string, title: string): string {
  const titleRegex = /<title>[^<]*<\/title>/i;
  const titleTag = `<title>${title}</title>`;

  if (titleRegex.test(html)) {
    return html.replace(titleRegex, titleTag);
  }

  return html.replace("</head>", `  ${titleTag}\n</head>`);
}

function buildRouteHtml(baseHtml: string, routePath: string, title: string, description: string, robots = "index, follow"): string {
  const canonicalUrl = routePath === "/" ? `${BASE_URL}/` : `${BASE_URL}${routePath}`;

  let html = baseHtml;
  html = withTitle(html, title);
  html = upsertMetaTag(html, "description", description);
  html = upsertMetaTag(html, "robots", robots);
  html = upsertMetaTag(html, "og:title", title, true);
  html = upsertMetaTag(html, "og:description", description, true);
  html = upsertMetaTag(html, "og:url", canonicalUrl, true);
  html = upsertMetaTag(html, "twitter:title", title);
  html = upsertMetaTag(html, "twitter:description", description);
  html = upsertCanonical(html, canonicalUrl);
  html = injectInternalLinkHub(html, routePath);
  return html;
}

function injectInternalLinkHub(html: string, currentPath: string): string {
  const links = SEO_PRERENDER_TEMPLATES
    .filter((template) => template.path !== currentPath)
    .map((template) => `<a href="${template.path}">${template.title}</a>`)
    .join(" | ");

  const noscriptHub = `<noscript><nav aria-label="Internal site links">${links}</nav></noscript>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `  ${noscriptHub}\n</body>`);
  }

  return `${html}\n${noscriptHub}`;
}

async function writeRouteHtml(routePath: string, html: string): Promise<void> {
  if (routePath === "/") {
    await fs.writeFile(path.join(DIST_PUBLIC_DIR, "index.html"), html, "utf8");
    return;
  }

  const clean = routePath.replace(/^\//, "").replace(/\/+$/, "");
  const routeDir = path.join(DIST_PUBLIC_DIR, clean);
  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(path.join(routeDir, "index.html"), html, "utf8");
}

async function main() {
  const indexHtmlPath = path.join(DIST_PUBLIC_DIR, "index.html");
  const baseHtml = await fs.readFile(indexHtmlPath, "utf8");

  for (const template of SEO_PRERENDER_TEMPLATES) {
    const html = buildRouteHtml(
      baseHtml,
      template.path,
      template.title,
      template.description,
      template.robots ?? "index, follow",
    );
    await writeRouteHtml(template.path, html);
  }

  const notFoundHtml = buildRouteHtml(
    baseHtml,
    "/404",
    "404 - Page Not Found | Ask Detectives",
    "The page you requested does not exist.",
    "noindex, follow",
  );
  await fs.writeFile(path.join(DIST_PUBLIC_DIR, "404.html"), notFoundHtml, "utf8");

  const manifestPath = path.join(DIST_PUBLIC_DIR, "seo-prerender-manifest.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        routeCount: SEO_PRERENDER_TEMPLATES.length,
        routes: SEO_PRERENDER_TEMPLATES,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`✅ SEO prerender complete (${SEO_PRERENDER_TEMPLATES.length} templates + 404.html)`);
}

main().catch((error) => {
  console.error("❌ SEO prerender failed:", error);
  process.exit(1);
});
