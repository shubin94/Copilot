import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Layers, AlertCircle } from "lucide-react";
import { useServiceCategories } from "@/lib/hooks";
import { useMemo, useState } from "react";
import { Link } from "wouter";

export default function CategoriesPage() {
  const { data, isLoading } = useServiceCategories(true);
  const [search, setSearch] = useState("");
  const categories = data?.categories || [];
  const sorted = useMemo(() => {
    const arr = categories.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!search.trim()) return arr;
    const q = search.trim().toLowerCase();
    return arr.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="Browse Categories" description="Explore all detective service categories available on the site." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold font-heading">Browse Categories</h1>
            <p className="text-gray-600 mt-2">All categories sorted alphabetically</p>
          </div>
          <div className="w-64">
            <Input placeholder="Search categories" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [1,2,3,4,5,6].map((i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg w-12 h-12" />
                    <div className="flex-1 space-y-2">
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : sorted.length > 0 ? (
            sorted.map((category) => (
              <Link key={category.id} href={`/search?category=${encodeURIComponent(category.name)}`}>
                <Card className="hover:shadow-lg transition-all hover:border-green-500 cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                        <Layers className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 transition-colors mb-2">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {category.description || "Professional investigation services"}
                        </p>
                        <div className="mt-3 flex items-center text-sm text-green-600 font-medium group-hover:gap-2 transition-all">
                          View results
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">No categories yet</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
