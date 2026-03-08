import { pool } from "../../db/index.js";
import { removeDefaultMetaTags } from "./seo-injection.js";

export interface CmsPageSeo {
  title: string;
  description: string;
  h1?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function getPublishedCmsPageSeo(slug: string): Promise<CmsPageSeo | null> {
  try {
    const queryWithH1 = `
      SELECT title, meta_title, meta_description, h1
      FROM pages
      WHERE slug = $1 AND status = 'published'
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const queryWithoutH1 = `
      SELECT title, meta_title, meta_description
      FROM pages
      WHERE slug = $1 AND status = 'published'
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    let result;
    try {
      result = await pool.query(queryWithH1, [slug]);
    } catch (error: any) {
      if (error?.code === "42703") {
        result = await pool.query(queryWithoutH1, [slug]);
      } else {
        throw error;
      }
    }

    if (!result.rows.length) return null;

    const row = result.rows[0] as {
      title?: string;
      meta_title?: string;
      meta_description?: string;
      h1?: string;
    };

    const fallbackTitle = row.title?.trim() || slug;

    return {
      title: row.meta_title?.trim() || fallbackTitle,
      description:
        row.meta_description?.trim() || `Learn more about ${fallbackTitle} on Ask Detectives.`,
      h1: row.h1?.trim() || row.title?.trim() || undefined,
    };
  } catch (error) {
    console.error("[CMS SEO] Failed to fetch page SEO:", {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function injectCmsPageSeoTags(
  htmlContent: string,
  seo: CmsPageSeo,
  canonicalUrl: string
): string {
  let cleaned = removeDefaultMetaTags(htmlContent);

  const metaTags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:site_name" content="Ask Detectives" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  ];

  const [titleTag, ...rest] = metaTags;
  let injected = cleaned;

  if (injected.includes("<!-- SEO_TITLE_INJECTION_POINT -->")) {
    injected = injected.replace(
      /<!-- SEO_TITLE_INJECTION_POINT -->/,
      `<!-- SEO_TITLE_INJECTION_POINT -->\n    ${titleTag}`
    );
  }

  if (injected.includes("<!-- SEO_META_INJECTION_POINT -->")) {
    injected = injected.replace(
      /<!-- SEO_META_INJECTION_POINT -->/,
      `<!-- SEO_META_INJECTION_POINT -->\n    ${rest.join("\n    ")}`
    );
  }

  if (
    !injected.includes("<!-- SEO_TITLE_INJECTION_POINT -->") ||
    !injected.includes("<!-- SEO_META_INJECTION_POINT -->")
  ) {
    injected = injected.replace("</head>", `    ${metaTags.join("\n    ")}\n  </head>`);
  }

  return injected;
}