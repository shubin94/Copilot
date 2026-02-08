import { useRoute } from "wouter";
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
  category: { id: string; name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
}

interface TagResponse {
  tag: { id: string; name: string; slug: string } | null;
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

export default function PageTag() {
  const [matchNested, paramsNested] = useRoute("/blog/tag/:parent/:slug");
  const [match, params] = useRoute("/blog/tag/:slug");
  if (!matchNested && !match) return null;
  const slug = matchNested
    ? `${paramsNested?.parent}/${paramsNested?.slug}`
    : (params?.slug as string);

  const { data, isLoading, isError } = useQuery<TagResponse>({
    queryKey: ["page-tag", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/tags/${slug}/pages`);
      if (!res.ok) {
        throw new Error("Failed to load tag");
      }
      return res.json();
    },
    enabled: !!slug,
  });

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">Failed to load tag.</div>
    );
  }

  const tagName = data?.tag?.name || "Tag";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title={`${tagName} | Pages`} description={`Pages tagged ${tagName}`} />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">#{tagName}</h1>
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
              <Link key={page.id} href={`/${page.category?.slug}/${page.slug}`}>
                <div className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white">
                  {page.bannerImage && (
                    <img
                      src={page.bannerImage}
                      alt={page.title}
                      className="w-full h-44 object-cover"
                    />
                  )}
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {page.category && <Badge variant="secondary">{page.category.name}</Badge>}
                      <Badge variant="outline">#{tagName}</Badge>
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
          <div className="text-gray-500">No pages with this tag yet</div>
        )}
      </main>
      <Footer />
    </div>
  );
}
