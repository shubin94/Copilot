export interface PrerenderTemplate {
  path: string;
  title: string;
  description: string;
  robots?: string;
}

const RESERVED_PREFIXES = [
  "/api",
  "/assets",
  "/@vite",
  "/@fs",
  "/node_modules",
];

const STATIC_EXTENSIONS = [
  ".js",
  ".css",
  ".map",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".txt",
  ".xml",
  ".pdf",
];

export const SEO_PRERENDER_TEMPLATES: PrerenderTemplate[] = [
  {
    path: "/",
    title: "Ask Detectives | Find Professional Private Investigators",
    description: "Find vetted private investigators and detective services. Compare ratings, services, and contact trusted professionals.",
  },
  {
    path: "/search",
    title: "Search Detectives | Ask Detectives",
    description: "Search verified detective profiles by city, service, and rating to find the best-fit investigator quickly.",
  },
  {
    path: "/categories",
    title: "Detective Service Categories | Ask Detectives",
    description: "Explore investigation service categories and discover specialists for personal, legal, and corporate cases.",
  },
  {
    path: "/blog",
    title: "Case Studies & Investigation Insights | Ask Detectives",
    description: "Read investigation case studies, legal insights, and practical guidance from professional detectives.",
  },
  {
    path: "/about",
    title: "About Ask Detectives",
    description: "Learn about Ask Detectives and how we connect clients with trusted investigation professionals.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy | Ask Detectives",
    description: "Review how Ask Detectives collects, secures, and processes personal data.",
  },
  {
    path: "/terms",
    title: "Terms and Conditions | Ask Detectives",
    description: "Read the terms and conditions for using Ask Detectives and related services.",
  },
  {
    path: "/packages",
    title: "Detective Packages & Plans | Ask Detectives",
    description: "Compare detective listing packages and choose the plan that matches your business goals.",
  },
  {
    path: "/support",
    title: "Support Center | Ask Detectives",
    description: "Get help with listings, account access, and platform guidance from the Ask Detectives support team.",
  },
  {
    path: "/contact",
    title: "Contact Ask Detectives",
    description: "Reach the Ask Detectives team for business, support, and partnership requests.",
  },
];

const SPA_ROUTE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/service\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/?$/,
  /^\/claim-profile\/[^/]+\/?$/,
  /^\/claim-account\/?$/,
  /^\/login\/?$/,
  /^\/signup\/?$/,
  /^\/detective-signup\/?$/,
  /^\/application-under-review\/?$/,
  /^\/search\/?$/,
  /^\/category\/[^/]+\/?$/,
  /^\/categories\/?$/,
  /^\/blog\/?$/,
  /^\/blog\/category\/[^/]+\/?$/,
  /^\/blog\/category\/[^/]+\/[^/]+\/?$/,
  /^\/blog\/tag\/[^/]+\/?$/,
  /^\/blog\/tag\/[^/]+\/[^/]+\/?$/,
  /^\/about\/?$/,
  /^\/privacy\/?$/,
  /^\/terms\/?$/,
  /^\/packages\/?$/,
  /^\/support\/?$/,
  /^\/contact\/?$/,
  /^\/admin(?:\/.*)?$/,
  /^\/detective(?:\/.*)?$/,
  /^\/user(?:\/.*)?$/,
  /^\/detectives\/[^/]+\/?$/,
  /^\/detectives\/[^/]+\/[^/]+\/?$/,
  /^\/detectives\/[^/]+\/[^/]+\/[^/]+\/?$/,
  /^\/detectives\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/?$/,
  /^\/news\/[^/]+\/?$/,
  /^\/p\/[^/]+\/?$/,
  /^\/pages\/[^/]+\/?$/,
  /^\/pages\/[^/]+\/[^/]+\/?$/,
  /^\/pages\/[^/]+\/[^/]+\/[^/]+\/?$/,
  /^\/[^/]+\/[^/]+\/?$/,
  /^\/[^/]+\/[^/]+\/[^/]+\/?$/,
];

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function isStaticAssetPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (RESERVED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return true;
  }
  return STATIC_EXTENSIONS.some((ext) => normalized.toLowerCase().endsWith(ext));
}

export function isKnownSpaPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(normalized));
}
