import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { parseContentBlocks } from "@/shared/content-blocks";

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  bannerImage?: string;
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
}

interface RelatedPostsProps {
  currentPostId: string;
  categoryId?: string;
  tags?: Array<{ id: string; name: string; slug: string }>;
}

function getExcerpt(content: string): string {
  const blocks = parseContentBlocks(content);
  const paragraph = blocks.find((b) => b.type === "paragraph");
  if (paragraph && "text" in paragraph) {
    const text = paragraph.text;
    return text.length > 150 ? text.substring(0, 150) + "..." : text;
  }
  return "";
}

export function RelatedPosts({ currentPostId, categoryId, tags = [] }: RelatedPostsProps) {
  const { data, isLoading } = useQuery<RelatedPost[]>({
    queryKey: ["related-posts", currentPostId, categoryId],
    queryFn: async () => {
      // Fetch posts from same category
      if (categoryId) {
        const res = await fetch(`/api/public/categories/${categoryId}/pages`);
        if (!res.ok) return [];
        const data = await res.json();
        // Filter out current post and return max 3
        return data.pages
          .filter((p: RelatedPost) => p.id !== currentPostId)
          .slice(0, 3);
      }
      return [];
    },
    enabled: !!categoryId,
  });

  if (isLoading) {
    return (
      <section className="mt-16 py-12 bg-gray-50">
        <div className="container mx-auto px-6 md:px-12 lg:px-24">
          <h2 className="text-3xl font-bold mb-8">Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-16 py-12 bg-gray-50">
      <div className="container mx-auto px-6 md:px-12 lg:px-24">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Related Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.map((post) => (
            <Link key={post.id} href={`/${post.category?.slug}/${post.slug}`}>
              <div className="bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-shadow h-full">
                {post.bannerImage && (
                  <img
                    src={post.bannerImage}
                    alt={`${post.title} - ${post.category?.name || 'Article'}`}
                    className="w-full h-44 object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {post.category && (
                      <Badge variant="secondary">{post.category.name}</Badge>
                    )}
                    {post.tags[0] && (
                      <Badge variant="outline">#{post.tags[0].name}</Badge>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 text-sm line-clamp-3">
                    {getExcerpt(post.content) || "Read more..."}
                  </p>
                  <div className="pt-3">
                    <span className="text-blue-600 text-sm font-medium hover:underline">
                      Read Article →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
