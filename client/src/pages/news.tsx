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

// Simple HTML sanitization: removes dangerous content while preserving safe HTML
function sanitizeHtml(html: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  let sanitized = textarea.value;
  
  // Remove script tags and event handlers
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');
  
  return sanitized;
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

export default function ArticlePage() {
  const [, params] = useRoute("/news/:slug");
  const [article, setArticle] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = params?.slug || "";

  useEffect(() => {
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
  }, [slug]);

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

  const formattedDate = new Date(article.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
