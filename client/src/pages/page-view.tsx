import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { parseContentBlocks } from "@/shared/content-blocks";
import { renderBlocks } from "@/utils/render-blocks";
import { RelatedPosts } from "@/components/related-posts";
import NotFound from "./not-found";

const publishedDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatPublishedDate(value: string) {
  return publishedDateFormatter.format(new Date(value));
}

interface PageData {
  id: string;
  title: string;
  titleTag?: string;
  slug: string;
  content: string;
  bannerImage?: string;
  status: string;
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
  createdAt: string;
  updatedAt: string;
  categoryPath?: string | null;
  author?: {
    name: string;
    email?: string;
    bio?: string;
    socialProfiles?: Array<{
      platform: string;
      url: string;
    }>;
  } | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

// ── Hydration seed helpers ────────────────────────────────────────────────────
const _cmsPageSeed: PageData | null = (() => {
  try {
    const d = (window as any).CMS_PAGE_DATA ?? (window as any).__CMS_PAGE_DATA__;
    return d && typeof d === "object" && d.slug ? (d as PageData) : null;
  } catch {
    return null;
  }
})();

let _cmsPageSeedConsumed = false;
function consumeCmsPageSeed(): PageData | null {
  if (_cmsPageSeedConsumed || !_cmsPageSeed) return null;
  _cmsPageSeedConsumed = true;
  return _cmsPageSeed;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function PageView() {
  const [locationPath, setLocation] = useLocation();
  const [matchNested, paramsNested] = useRoute("/:parent/:category/:slug");
  const [matchNew, paramsNew] = useRoute("/:category/:slug");
  const [matchLegacyNested, paramsLegacyNested] = useRoute("/pages/:parent/:category/:slug");
  const [matchLegacyCategory, paramsLegacyCategory] = useRoute("/pages/:category/:slug");
  const [matchLegacy, paramsLegacy] = useRoute("/pages/:slug");

  const slug = (
    matchNested
      ? paramsNested?.slug
      : matchNew
      ? paramsNew?.slug
      : matchLegacyNested
      ? paramsLegacyNested?.slug
      : matchLegacyCategory
      ? paramsLegacyCategory?.slug
      : paramsLegacy?.slug
  ) as string;
  const categorySlug = (
    matchNested
      ? `${paramsNested?.parent}/${paramsNested?.category}`
      : matchNew
      ? paramsNew?.category
      : matchLegacyNested
      ? `${paramsLegacyNested?.parent}/${paramsLegacyNested?.category}`
      : matchLegacyCategory
      ? paramsLegacyCategory?.category
      : undefined
  ) as string | undefined;

  const normalizedCategoryPath = (categorySlug || "").replace(/^\/+|\/+$/g, "").toLowerCase();
  const seedCategoryPath = ((_cmsPageSeed as any)?.categoryPath || _cmsPageSeed?.category?.slug || "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  // Validate seed against current route category path + slug before using
  const seedMatchesRoute = !!(
    _cmsPageSeed
    && slug
    && normalizedCategoryPath
    && _cmsPageSeed.slug === slug
    && seedCategoryPath === normalizedCategoryPath
  );

  const { data, isLoading, isError } = useQuery<{ page: PageData }>({
    queryKey: ["public-page", categorySlug || "", slug],
    queryFn: async () => {
      const endpoint = categorySlug
        ? `/api/public/pages/${categorySlug}/${slug}`
        : `/api/public/pages/${slug}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Page not found" : "Failed to load page");
      }
      return res.json();
    },
    // Skip fetch on first render when seed matches — React Query will still revalidate later
    initialData: seedMatchesRoute ? () => {
      const seed = consumeCmsPageSeed();
      return seed ? { page: seed } : undefined;
    } : undefined,
    staleTime: seedMatchesRoute ? 60_000 : 0,
    enabled: !!slug && (matchNested || matchNew || matchLegacyNested || matchLegacyCategory || matchLegacy),
  });

  // Move useEffect before conditional returns to comply with React hooks rules
  useEffect(() => {
    if ((matchLegacy || matchLegacyCategory) && data?.page?.category?.slug) {
      setLocation(`/${data.page.category.slug}/${data.page.slug}`);
    }
  }, [matchLegacy, matchLegacyCategory, data?.page?.category?.slug, data?.page?.slug, setLocation]);

  // Early return AFTER all hooks
  if (!matchNested && !matchNew && !matchLegacyNested && !matchLegacyCategory && !matchLegacy) return null;

  if (isError) return <NotFound />;
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );

  if (!data?.page) return <NotFound />;

  const page = data.page;
  const canonicalCategoryPath = (page.categoryPath || categorySlug || page.category?.slug || "")
    .replace(/^\/+|\/+$/g, "");
  const canonicalPath = canonicalCategoryPath
    ? `/${canonicalCategoryPath}/${page.slug}`
    : `/${page.slug}`;
  const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
  
  const breadcrumbs = page.category
    ? [
        { name: "Home", url: "/" },
        { name: page.category.name, url: `/blog/category/${page.category.slug}` },
        { name: page.title, url: canonicalUrl }
      ]
    : [
        { name: "Home", url: "/" },
        { name: page.title, url: canonicalUrl }
      ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO 
        title={page.metaTitle || page.title} 
        description={page.metaDescription || page.title}
        canonical={canonicalUrl}
        breadcrumbs={breadcrumbs}
        publishedTime={page.createdAt || ""}
        modifiedTime={page.updatedAt || ""}
        image={page.bannerImage}
        author={page.author ? {
          name: page.author.name,
          email: page.author.email
        } : undefined}
        structuredData={{
          article: {
            headline: page.h1 || page.title,
            author: page.author?.name || "Ask Detectives",
            datePublished: page.createdAt,
            dateModified: page.updatedAt,
            image: page.bannerImage,
            articleSection: page.category?.name,
            keywords: page.tags.map(t => t.name)
          }
        }}
      />
      <Navbar />

      {page.bannerImage && (
        <section className="bg-emerald-900 text-white">
          <div className="container mx-auto px-6 md:px-12 lg:px-24 pt-24 pb-12">
            <div className="grid gap-8 lg:grid-cols-2 items-center">
              <div>
                {page.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-800 text-emerald-100 mb-4">
                    {page.category.name}
                  </span>
                )}
                <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                  {page.h1 || page.title}
                </h1>
                <p className="text-sm text-emerald-100">
                  Published: {formatPublishedDate(page.createdAt)}
                </p>
              </div>
              <div className="w-full">
                  <img
                    src={page.bannerImage}
                    alt="Article banner image"
                    width={800}
                    height={320}
                    className="w-full h-64 md:h-80 lg:h-96 object-cover rounded-2xl shadow-xl"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
              </div>
            </div>
          </div>
        </section>
      )}

      <main
        className={`flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 ${
          page.bannerImage ? "" : "mt-16"
        }`}
      >
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-600">
          <a href="/" className="hover:text-blue-600 transition">
            Home
          </a>
          {page.category && (
            <>
              <span className="mx-2">/</span>
              <a
                href={`/blog/category/${page.category.slug}`}
                className="hover:text-blue-600 transition"
              >
                {page.category.name}
              </a>
            </>
          )}
          <span className="mx-2">/</span>
          <span>{page.title}</span>
        </nav>

        {/* Title and Meta */}
        <article>
          {!page.bannerImage && (
            <header className="mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                {page.h1 || page.title}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-gray-600 border-b pb-6">
                {page.category && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {page.category.name}
                  </span>
                )}

                <span className="text-sm">
                  Published: {formatPublishedDate(page.createdAt)}
                </span>

                {page.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {page.tags.map((tag) => (
                      <a
                        key={tag.id}
                        href={`/blog/tag/${tag.slug}`}
                        className="inline-block px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition"
                      >
                        #{tag.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </header>
          )}

          {page.bannerImage && page.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {page.tags.map((tag) => (
                <a
                  key={tag.id}
                  href={`/blog/tag/${tag.slug}`}
                  className="inline-block px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition"
                >
                  #{tag.name}
                </a>
              ))}
            </div>
          )}

          {/* Article Content */}
          <div>
            {renderBlocks(parseContentBlocks(page.content))}
          </div>

          {/* Author Section */}
          {page.author && (
            <div className="mt-12 pt-8 border-t bg-gray-50 rounded-lg p-6">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  Written by {page.author.name}
                </h3>
                {page.author.email && (
                  <p className="text-sm text-gray-600">
                    Contact: <a href={`mailto:${page.author.email}`} className="text-blue-600 hover:underline">
                      {page.author.email}
                    </a>
                  </p>
                )}
                {page.author.bio && (
                  <p className="text-sm text-gray-700 mt-3">
                    {page.author.bio}
                  </p>
                )}
                {page.author.socialProfiles && page.author.socialProfiles.length > 0 && (
                  <div className="flex gap-4 mt-4">
                    {page.author.socialProfiles.map((profile) => (
                      <a
                        key={profile.platform}
                        href={profile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 bg-white border rounded text-sm hover:bg-blue-50 transition"
                      >
                        {profile.platform}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Article Footer */}
          <div className="mt-12 pt-8 border-t">
            <div className="flex flex-wrap gap-4">
              {page.category && (
                <a
                  href={`/blog/category/${page.category.slug}`}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                >
                  More from {page.category.name}
                </a>
              )}
              <a
                href="/search"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
              >
                Browse All Pages
              </a>
            </div>
          </div>
        </article>
      </main>

      <RelatedPosts 
        currentPostId={page.id}
        categoryId={page.category?.id}
        tags={page.tags}
      />

      <Footer />
    </div>
  );
}
