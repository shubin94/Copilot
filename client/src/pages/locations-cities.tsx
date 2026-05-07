import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type CityItem = {
  name: string;
  slug: string;
  stateSlug: string;
  countrySlug: string;
  detectiveCount: number;
};

export default function LocationsCitiesPage() {
  const [cities, setCities] = useState<CityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchCities = async () => {
      try {
        setIsLoading(true);
        const data = await api.get<{ cities: CityItem[] }>("/api/locations/cities-list?limit=2000");
        if (!isMounted) return;
        setCities(data.cities || []);
      } catch (error) {
        console.error("[LocationsCitiesPage] Failed to load cities:", error);
        if (!isMounted) return;
        setCities([]);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    fetchCities();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatDetectiveCount = (count: number) => `${count} Detective${count === 1 ? "" : "s"}`;

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
      <SEO
        title="All Cities with Detectives | AskDetectives"
        description="Browse all cities where active detectives are available on AskDetectives."
        canonical="https://www.askdetectives.com/locations/cities"
      />
      <Navbar />

      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-heading">All Cities</h1>
          <Link href="/">
            <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50 font-normal">
              Back Home <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-600">Loading cities...</div>
        ) : cities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cities.map((item) => (
              <Link
                key={`city-${item.countrySlug}-${item.stateSlug}-${item.slug}`}
                href={`/detectives/${item.countrySlug}/${item.stateSlug}/${item.slug}`}
              >
                <div className="block rounded-lg border border-green-100 bg-green-50 px-4 py-3 transition-colors hover:bg-green-100 cursor-pointer">
                  <div className="text-sm font-semibold text-green-900">{item.name}</div>
                  <div className="text-xs text-green-700">{formatDetectiveCount(item.detectiveCount)}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No cities available.</div>
        )}
      </main>

      <Footer />
    </div>
  );
}
