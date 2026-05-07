import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { DetectiveCard } from "@/components/DetectiveCard";
import { getDetectiveProfileUrl } from "@/lib/utils";

const articleDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

// Allowlist-based HTML sanitization: strips everything except known-safe tags and attributes.
// Regex sanitization can be bypassed (entity encoding, malformed tags, etc.) so we use
// a strict allowlist via the browser's own DOM parser.
function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") {
    // SSR fallback: strip all tags
    return html.replace(/<[^>]*>/g, "");
  }

  const ALLOWED_TAGS = new Set([
    "p", "br", "b", "strong", "i", "em", "u", "s", "strike",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "img", "hr", "table", "thead", "tbody", "tr", "th", "td",
    "span", "div", "figure", "figcaption",
  ]);
  const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(["href", "title", "target", "rel"]),
    img: new Set(["src", "alt", "width", "height", "loading"]),
    td: new Set(["colspan", "rowspan"]),
    th: new Set(["colspan", "rowspan"]),
  };
  const SAFE_URL = /^(https?:|\/\/)/i;

  const doc = new DOMParser().parseFromString(html, "text/html");

  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Replace disallowed element with its children (unwrap)
      const frag = document.createDocumentFragment();
      el.childNodes.forEach(child => {
        const sanitized = sanitizeNode(child);
        if (sanitized) frag.appendChild(sanitized);
      });
      return frag;
    }
    const clean = document.createElement(tag);
    const allowed = ALLOWED_ATTRS[tag];
    if (allowed) {
      allowed.forEach(attr => {
        if (attr === "rel") return; // handled below after all attrs are set
        const val = el.getAttribute(attr);
        if (val !== null) {
          if ((attr === "href" || attr === "src") && !SAFE_URL.test(val.trim())) return;
          if (attr === "target") { clean.setAttribute(attr, "_blank"); return; }
          clean.setAttribute(attr, val);
        }
      });
      // Always force rel="noopener noreferrer" when target="_blank" is present
      if (tag === "a") {
        const rel = el.getAttribute("rel");
        clean.setAttribute("rel", clean.getAttribute("target") === "_blank"
          ? "noopener noreferrer"
          : (rel ?? ""));
      }
    }
    el.childNodes.forEach(child => {
      const sanitized = sanitizeNode(child);
      if (sanitized) clean.appendChild(sanitized);
    });
    return clean;
  }

  const result = document.createDocumentFragment();
  doc.body.childNodes.forEach(child => {
    const sanitized = sanitizeNode(child);
    if (sanitized) result.appendChild(sanitized);
  });

  const wrapper = document.createElement("div");
  wrapper.appendChild(result);
  return wrapper.innerHTML;
}

interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerptHtml?: string;
  category: string;
  featured: boolean;
  thumbnail?: string;
  viewCount: number;
  publishedAt: string;
  createdAt: string;
  detective?: {
    id: string;
    businessName?: string;
    slug?: string;
    logo?: string;
    city?: string;
    state?: string;
    country?: string;
    isVerified?: boolean;
    effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean };
  };
}

// ── Hydration seed helpers ────────────────────────────────────────────────────
const _articleSeed: CaseStudy | null = (() => {
  try {
    const d = (window as any).ARTICLE_PAGE_DATA ?? (window as any).__ARTICLE_PAGE_DATA__;
    return d && typeof d === "object" && d.slug ? (d as CaseStudy) : null;
  } catch {
    return null;
  }
})();

let _articleSeedConsumed = false;
function consumeArticleSeed(): CaseStudy | null {
  if (_articleSeedConsumed || !_articleSeed) return null;
  _articleSeedConsumed = true;
  return _articleSeed;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ArticlePage() {
  const [, params] = useRoute("/news/:slug");
  const [article, setArticle] = useState<CaseStudy | null>(() => {
    const seed = consumeArticleSeed();
    // Only use seed when slug matches
    if (seed && params?.slug && seed.slug === params.slug) return seed;
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const seed = _articleSeed;
    if (seed && params?.slug && seed.slug === params.slug) return false;
    return true;
  });
  const [error, setError] = useState<string | null>(null);

  const slug = params?.slug || "";

  useEffect(() => {
    // Skip initial fetch if we already have a seed that matches
    if (article && article.slug === slug) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/case-studies/${slug}`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError("Article not found");
          } else {
            setError("Failed to load article");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setArticle(data.caseStudy || null);
      } catch (err) {
        console.error("Error fetching article:", err);
        setError("An error occurred while loading the article");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchArticle();
    }
  }, [slug, article]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto px-6 py-12">
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-12" />
          <Skeleton className="h-96 w-full mb-8" />
          <Skeleton className="h-32 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-white">
        <SEO 
          title="Article Not Found | Ask Detectives"
          description="The article you're looking for was not found."
          robots="noindex, follow"
        />
        <Navbar />
        <main className="container mx-auto px-6 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Article Not Found</h1>
            <p className="text-gray-600 mb-8">{error}</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/news">Browse All Articles</a>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const formattedDate = articleDateFormatter.format(new Date(article.publishedAt));

  // SEO Metadata
  const seoTitle = `${article.title} | Case Studies | Ask Detectives`;
  const seoDescription = article.excerptHtml 
    ? article.excerptHtml.replace(/<[^>]*>/g, "").substring(0, 160)
    : `Case study: ${article.title}. Professional private investigation and detective services.`;
  const canonicalUrl = `https://www.askdetectives.com/news/${article.slug}`;

  const breadcrumbs = [
    { name: "Home", url: "https://www.askdetectives.com/" },
    { name: "News & Cases", url: "https://www.askdetectives.com/news/" },
    { name: article.title, url: canonicalUrl },
  ];

  // Article Schema (NewsArticle or BlogPosting)
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "description": seoDescription,
    "image": article.thumbnail || "https://www.askdetectives.com/favicon.png",
    "datePublished": article.publishedAt,
    "dateModified": (article as any).updatedAt || article.publishedAt,
    "author": article.detective
      ? {
          "@type": "Person",
          "name": article.detective.businessName || "Detective",
          "url": `https://www.askdetectives.com${getDetectiveProfileUrl(article.detective)}`,
        }
      : {
          "@type": "Organization",
          "name": "Ask Detectives",
        },
    "publisher": {
      "@type": "Organization",
      "name": "Ask Detectives",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.askdetectives.com/favicon.png",
      },
    },
    "mainEntity": {
      "@type": "Article",
      "headline": article.title,
      "articleBody": article.content.replace(/<[^>]*>/g, ""),
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        robots="index, follow"
        image={article.thumbnail || ""}
        schema={articleSchema}
        breadcrumbs={breadcrumbs}
        keywords={[
          article.title,
          article.category,
          "case study",
          "detective",
          "investigation",
          article.detective?.city || "",
        ].filter(Boolean)}
      />
      <Navbar />

      <main className="container mx-auto px-6 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex flex-wrap gap-2 text-sm text-gray-600">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center gap-2">
                {idx > 0 && <span>/</span>}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="text-gray-900 font-medium">{crumb.name}</span>
                ) : (
                  <a href={crumb.url} className="text-blue-600 hover:underline">
                    {crumb.name}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Article Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary">{article.category}</Badge>
            {article.featured && (
              <Badge className="bg-amber-100 text-amber-800">Featured</Badge>
            )}
          </div>
          <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formattedDate}
            </div>
            {article.viewCount > 0 && (
              <div className="text-sm text-gray-500">
                {article.viewCount.toLocaleString()} views
              </div>
            )}
          </div>
        </div>

        {/* Article Thumbnail */}
        {article.thumbnail && (
          <div className="mb-8">
            <img
              src={article.thumbnail}
              alt={article.title}
              width={320}
              height={240}
              className="w-full h-96 object-cover rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* Article Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div
              className="prose prose-sm max-w-none mb-8 text-gray-700"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Featured Detective Card */}
            {article.detective && (
              <Card className="mb-6 sticky top-6">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-4">Featured Detective</h3>
                  <DetectiveCard detective={article.detective} variant="newsFeatured" />
                </CardContent>
              </Card>
            )}

            {/* Related Info Box */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <h4 className="font-bold text-sm mb-3">About This Case</h4>
                <p className="text-sm text-gray-700 mb-4">
                  This case study highlights professional investigation techniques and successful outcomes
                  in the {article.category.toLowerCase()} field.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <a href="/news">View More Cases</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold mb-2">Need Investigation Services?</h3>
            <p className="text-gray-700 mb-6">
              Get help from experienced private detectives in your area.
            </p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/search">Find a Detective</a>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
