import { URL } from "node:url";
import { SEO_PRERENDER_TEMPLATES } from "../server/lib/spa-route-manifest.ts";

const BASE_URL = process.env.SEO_AUDIT_BASE_URL ?? "https://www.askdetectives.com";
const SITEMAP_URL = process.env.SEO_AUDIT_SITEMAP_URL ?? `${BASE_URL.replace(/\/+$/, "")}/sitemap.xml`;
const MAX_URLS = Number(process.env.SEO_AUDIT_MAX_URLS ?? 300);
const MIN_AVG_INTERNAL_LINKS = Number(process.env.SEO_AUDIT_MIN_AVG_LINKS ?? 5);
const MAX_ORPHAN_RATE = Number(process.env.SEO_AUDIT_MAX_ORPHAN_RATE ?? 0.2);
const MAX_RETRIES = Number(process.env.SEO_AUDIT_RETRIES ?? 3);

interface LinkGraphNode {
  url: string;
  outLinks: Set<string>;
  inDegree: number;
  crawled: boolean;
}

function getFallbackSeedUrls(): string[] {
  const seeded = new Set<string>();
  for (const route of SEO_PRERENDER_TEMPLATES) {
    const normalized = normalizeUrl(route.path);
    if (normalized) seeded.add(normalized);
  }
  const home = normalizeUrl("/");
  if (home) seeded.add(home);
  return Array.from(seeded);
}

function normalizeUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, BASE_URL);
    const base = new URL(BASE_URL);

    if (parsed.hostname !== base.hostname) return null;
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

    return parsed.toString();
  } catch {
    return null;
  }
}

function extractSitemapUrls(xml: string): string[] {
  const locRegex = /<loc>(.*?)<\/loc>/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    const normalized = normalizeUrl(match[1].trim());
    if (normalized) urls.push(normalized);
  }

  return Array.from(new Set(urls));
}

function extractInternalLinks(html: string): string[] {
  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }

    const normalized = normalizeUrl(href);
    if (normalized) links.push(normalized);
  }

  return Array.from(new Set(links));
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "AskDetectives-SEO-Audit/1.0",
          accept: "text/html,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (response.ok) {
        return response.text();
      }

      const isRetriable = response.status === 429 || response.status >= 500;
      if (!isRetriable || attempt === MAX_RETRIES) {
        throw new Error(`Request failed (${response.status}) for ${url}`);
      }

      const waitMs = attempt * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        throw lastError;
      }
      const waitMs = attempt * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

async function buildLinkGraph(seedUrls: string[]): Promise<Map<string, LinkGraphNode>> {
  const graph = new Map<string, LinkGraphNode>();

  for (const url of seedUrls.slice(0, MAX_URLS)) {
    graph.set(url, { url, outLinks: new Set(), inDegree: 0, crawled: false });
  }

  for (const node of graph.values()) {
    try {
      const html = await fetchText(node.url);
      node.crawled = true;
      const outLinks = extractInternalLinks(html);

      for (const target of outLinks) {
        if (!graph.has(target)) continue;
        node.outLinks.add(target);
      }
    } catch (error) {
      console.warn(`⚠️ Skipping ${node.url}: ${error}`);
    }
  }

  for (const node of graph.values()) {
    for (const target of node.outLinks) {
      const targetNode = graph.get(target);
      if (targetNode) {
        targetNode.inDegree += 1;
      }
    }
  }

  return graph;
}

async function main() {
  try {
    let sitemapUrls: string[] = [];

    try {
      const sitemapXml = await fetchText(SITEMAP_URL);
      sitemapUrls = extractSitemapUrls(sitemapXml);
    } catch (error) {
      console.warn(`⚠️ Sitemap fetch failed (${SITEMAP_URL}), falling back to SEO template seeds: ${error}`);
    }

    if (sitemapUrls.length === 0) {
      sitemapUrls = getFallbackSeedUrls();
    }

    if (sitemapUrls.length === 0) {
      console.error("❌ No URLs found in sitemap");
      process.exit(1);
    }

    const graph = await buildLinkGraph(sitemapUrls);
    const nodes = Array.from(graph.values());
    const crawledNodes = nodes.filter((node) => node.crawled);

    if (crawledNodes.length === 0) {
      console.error("❌ Internal-link audit could not crawl any pages (all responses failed or were rate-limited)");
      process.exit(1);
    }

    const totalNodes = crawledNodes.length;
    const totalOutLinks = crawledNodes.reduce((sum, node) => sum + node.outLinks.size, 0);
    const avgLinks = totalNodes > 0 ? totalOutLinks / totalNodes : 0;

    const normalizedBase = normalizeUrl(BASE_URL) ?? `${BASE_URL.replace(/\/+$/, "")}/`;
    const orphanNodes = crawledNodes.filter((node) => node.inDegree === 0 && node.url !== normalizedBase);
    const orphanRate = totalNodes > 0 ? orphanNodes.length / totalNodes : 0;

    console.log("🔗 Internal Link Graph Audit");
    console.log(`- Base URL: ${BASE_URL}`);
    console.log(`- Sitemap URL: ${SITEMAP_URL}`);
    console.log(`- Nodes analyzed: ${totalNodes}`);
    console.log(`- Edges analyzed: ${totalOutLinks}`);
    console.log(`- Average internal links/page: ${avgLinks.toFixed(2)}`);
    console.log(`- Orphan pages: ${orphanNodes.length} (${(orphanRate * 100).toFixed(2)}%)`);

    const failures: string[] = [];
    if (avgLinks < MIN_AVG_INTERNAL_LINKS) {
      failures.push(`Average links/page ${avgLinks.toFixed(2)} is below minimum ${MIN_AVG_INTERNAL_LINKS}`);
    }

    if (orphanRate > MAX_ORPHAN_RATE) {
      failures.push(`Orphan rate ${(orphanRate * 100).toFixed(2)}% exceeds ${(MAX_ORPHAN_RATE * 100).toFixed(2)}%`);
    }

    if (failures.length > 0) {
      console.error("\n❌ Internal-link graph quality check failed:");
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }

      const topOrphans = orphanNodes.slice(0, 10);
      if (topOrphans.length > 0) {
        console.error("\nTop orphan pages:");
        for (const orphan of topOrphans) {
          console.error(`- ${orphan.url}`);
        }
      }

      process.exit(1);
    }

    console.log("\n✅ Internal-link graph quality passed");
  } catch (error) {
    console.error("❌ Failed to audit internal-link graph:", error);
    process.exit(1);
  }
}

main();
