import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { ServiceCardComponent } from "@/components/home/service-card";

interface LocationListPageProps<T> {
  title: string;
  description: string;
  canonical: string;
  apiEndpoint: string;
  itemKey: (item: T) => string;
  itemProps: (item: T) => any;
}

export function LocationListPage<T>({
  title,
  description,
  canonical,
  apiEndpoint,
  itemKey,
  itemProps,
}: LocationListPageProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        const data = await fetch(apiEndpoint).then(res => res.json());
        if (!isMounted) return;
        setItems(data.cities || data.states || []);
      } catch (error) {
        if (!isMounted) return;
        setItems([]);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };
    fetchItems();
    return () => { isMounted = false; };
  }, [apiEndpoint]);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <SEO title={title} description={description} canonical={canonical} />
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        <nav className="mb-8 text-sm text-gray-600">
          <a href="/" className="hover:text-blue-600">Home</a>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{title}</span>
        </nav>
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-base text-gray-600 mb-2 max-w-3xl">{description}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Explore All Detectives in this Location</h2>
          <p className="text-gray-700 mb-2">Browse all verified private investigators available in this area.</p>
          <a href="/detectives" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors">
            View All Available Detectives
          </a>
        </div>
        {isLoading ? (
          <div className="text-base text-gray-600">Loading...</div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {items.map((item) => (
              <ServiceCardComponent key={itemKey(item)} {...itemProps(item)} />
            ))}
          </div>
        ) : (
          <div className="text-base text-gray-500">No results available.</div>
        )}
      </main>
      <Footer />
    </div>
  );
}
