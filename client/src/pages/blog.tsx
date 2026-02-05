import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function BlogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="Blog" description="Latest news, tips, and insights from the world of private investigation." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">Latest Insights</h1>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl">
          Stay up to date with the latest trends, tips, and news from the private investigation industry.
        </p>

        <Card className="p-12 text-center">
          <p className="text-gray-500">No blog posts available yet. Check back soon for the latest insights and news.</p>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
