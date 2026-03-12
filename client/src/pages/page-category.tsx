import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { parseContentBlocks } from "@/shared/content-blocks";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

interface PageCard {
  id: string;
  title: string;
  slug: string;
  content: string;
  bannerImage?: string;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  tags: Array<{ id: string; name: string; slug: string }>;
}

interface CategoryResponse {
  category: { id: string; name: string; slug: string } | null;
  pages: PageCard[];
}

function getExcerpt(content: string): string {
  const blocks = parseContentBlocks(content);
  const paragraph = blocks.find((b) => b.type === "paragraph");
  if (paragraph && "text" in paragraph) {
    return paragraph.text;
  }
  return "";
}

export default function PageCategory() {
  const [locationPath] = useLocation();
  const [matchNested, paramsNested] = useRoute("/blog/category/:parent/:slug");
  const [match, params] = useRoute("/blog/category/:slug");
  if (!matchNested && !match) return null;
  const slug = matchNested
    ? `${paramsNested?.parent}/${paramsNested?.slug}`
    : (params?.slug as string);

  const { data, isLoading, isError, error } = useQuery<CategoryResponse, any>({
    queryKey: ["page-category", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/categories/${slug}/pages`);
      if (!res.ok) {
        const fetchError: any = new Error(res.status === 404 ? "Category not found" : "Failed to load category");
        fetchError.status = res.status;
        throw fetchError;
      }
      return res.json();
    },
    enabled: !!slug,
  });

  if (isError && error?.status === 404) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <SEO
          title="Category Not Found"
          description="The requested category does not exist."
          robots="noindex, follow"
          canonical={`https://www.askdetectives.com${locationPath}`}
        />
        <Navbar />
        <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Category Not Found</h1>
          <p className="text-gray-600">This category does not exist or was removed.</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">Failed to load category.</div>
    );
  }

  const categoryName = data?.category?.name || "Category";
  const canonicalUrl = `https://www.askdetectives.com${locationPath}`;
  const archiveRobots = (data?.pages?.length || 0) > 0 ? "index, follow" : "noindex, follow";

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
    { name: categoryName, url: canonicalUrl }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO 
        title={`${categoryName} | Pages`} 
        description={`Pages in ${categoryName}`}
        canonical={canonicalUrl}
        robots={archiveRobots}
        breadcrumbs={breadcrumbs}
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">{categoryName}</h1>
          <p className="text-gray-600 mt-2">{data?.pages.length || 0} pages</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-80 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data?.pages.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.pages.map((page) => (
              <Link key={page.id} href={`/${page.category.slug}/${page.slug}`}>
                <div className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white">
                  {page.bannerImage && (
                      <img
                        src={page.bannerImage}
                        alt="Category banner"
                        width={800}
                        height={176}
                        className="w-full h-44 object-cover"
                        loading="lazy"
                      />
                  )}
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{page.category.name}</Badge>
                      {page.tags[0] && <Badge variant="outline">{page.tags[0].name}</Badge>}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
                      {page.title}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-4">
                      {getExcerpt(page.content) || "No preview available."}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No pages in this category yet</div>
        )}
      </main>
      <Footer />
    </div>
  );
}
