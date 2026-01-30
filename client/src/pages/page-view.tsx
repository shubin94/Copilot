import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { parseContentBlocks } from "@/shared/content-blocks";
import { renderBlocks } from "@/utils/render-blocks";
import NotFound from "./not-found";

interface PageData {
  id: string;
  title: string;
  slug: string;
  content: string;
  bannerImage?: string;
  status: string;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
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

export default function PageView() {
  const [, setLocation] = useLocation();
  const [matchNew, paramsNew] = useRoute("/:category/:slug");
  const [matchLegacyCategory, paramsLegacyCategory] = useRoute("/pages/:category/:slug");
  const [matchLegacy, paramsLegacy] = useRoute("/pages/:slug");

  if (!matchNew && !matchLegacyCategory && !matchLegacy) return null;

  const slug = (matchNew ? paramsNew?.slug : matchLegacyCategory ? paramsLegacyCategory?.slug : paramsLegacy?.slug) as string;
  const categorySlug = (matchNew ? paramsNew?.category : matchLegacyCategory ? paramsLegacyCategory?.category : undefined) as string | undefined;

  const { data, isLoading, isError } = useQuery<{ page: PageData }>({
    queryKey: ["public-page", slug],
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
    enabled: !!slug,
  });

  // Move useEffect before conditional returns to comply with React hooks rules
  useEffect(() => {
    if ((matchLegacy || matchLegacyCategory) && data?.page?.category?.slug) {
      setLocation(`/${data.page.category.slug}/${data.page.slug}`);
    }
  }, [matchLegacy, matchLegacyCategory, data?.page?.category?.slug, data?.page?.slug, setLocation]);

  if (isError) return <NotFound />;
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );

  if (!data?.page) return <NotFound />;

  const page = data.page;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO 
        title={page.metaTitle || page.title} 
        description={page.metaDescription} 
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
                  {page.title}
                </h1>
                <p className="text-sm text-emerald-100">
                  Published: {new Date(page.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="w-full">
                <img
                  src={page.bannerImage}
                  alt={page.title}
                  className="w-full h-64 md:h-80 lg:h-96 object-cover rounded-2xl shadow-xl"
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
                {page.title}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-gray-600 border-b pb-6">
                {page.category && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {page.category.name}
                  </span>
                )}

                <span className="text-sm">
                  Published: {new Date(page.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
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

      <Footer />
    </div>
  );
}
