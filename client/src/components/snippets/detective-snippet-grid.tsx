import { useEffect, useState } from "react";
import { ServiceCard } from "@/components/home/service-card";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";
import { Loader2 } from "lucide-react";

interface DetectiveSnippetGridProps {
  snippetId?: string;
  country?: string;
  state?: string;
  city?: string;
  category?: string;
  limit?: number;
}

interface Detective {
  id: string;
  fullName: string;
  level: string;
  profilePhoto: string;
  isVerified: boolean;
  location: string;
  avgRating: number;
  reviewCount: number;
  startingPrice: number;
}

export function DetectiveSnippetGrid({
  snippetId,
  country,
  state,
  city,
  category,
  limit = 4,
}: DetectiveSnippetGridProps) {
  const [detectives, setDetectives] = useState<Detective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetectives = async () => {
      try {
        setLoading(true);
        setError(null);

        // If snippetId is provided, use it to fetch snippet details first
        let queryParams = {};
        
        if (snippetId) {
          // Fetch snippet config
          const snippetRes = await fetch(`/api/snippets/${snippetId}`);
          if (!snippetRes.ok) throw new Error("Failed to load snippet");
          const snippetData = await snippetRes.json();
          const snippet = snippetData.snippet;
          queryParams = {
            country: snippet.country,
            state: snippet.state,
            city: snippet.city,
            category: snippet.category,
            limit: snippet.limit,
          };
        } else {
          // Use provided parameters
          if (!country || !category) {
            throw new Error("Either snippetId or both country and category are required");
          }
          queryParams = {
            country,
            state,
            city,
            category,
            limit,
          };
        }

        // Fetch detectives
        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });

        const detectivesRes = await fetch(`/api/snippets/detectives?${params.toString()}`);
        if (!detectivesRes.ok) throw new Error("Failed to load detectives");
        
        const detectivesData = await detectivesRes.json();
        setDetectives(detectivesData.detectives || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load detectives");
      } finally {
        setLoading(false);
      }
    };

    fetchDetectives();
  }, [snippetId, country, state, city, category, limit]);

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array(limit)
          .fill(0)
          .map((_, i) => (
            <ServiceCardSkeleton key={i} />
          ))}
      </div>
    );
  }

  if (detectives.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg">
        <p>No detectives found matching your criteria</p>
      </div>
    );
  }

  // Convert detective data to service card format
  const serviceCards = detectives.map((detective) => ({
    id: detective.id,
    detectiveId: detective.id,
    avatar: detective.profilePhoto || "",
    name: detective.fullName,
    level: detective.level.replace("level", "Level "),
    levelValue: parseInt(detective.level.match(/\d+/) ? detective.level.match(/\d+/)[0] : "1"),
    category: category || "",
    badges: detective.isVerified ? ["verified"] : [],
    title: `${category || "Services"}`,
    rating: detective.avgRating,
    reviews: detective.reviewCount,
    price: detective.startingPrice,
    location: detective.location,
    countryCode: country,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {serviceCards.map((card) => (
          <ServiceCard key={card.id} {...card} />
        ))}
      </div>
    </div>
  );
}
