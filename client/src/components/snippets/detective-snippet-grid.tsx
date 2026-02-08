import { useEffect, useState } from "react";
import { ServiceCard } from "@/components/home/service-card";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";
import { Loader2 } from "lucide-react";
import { computeServiceBadges } from "@/lib/service-badges";

interface DetectiveSnippetGridProps {
  snippetId?: string;
  country?: string;
  state?: string;
  city?: string;
  category?: string;
  limit?: number;
}

interface SnippetService {
  id: string;
  serviceId: string;
  fullName: string;
  level: string;
  profilePhoto: string;
  isVerified: boolean;
  location: string;
  country?: string;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
  avgRating: number;
  reviewCount: number;
  startingPrice: number;
  offerPrice?: number | null;
  isOnEnquiry?: boolean;
  serviceTitle?: string;
  serviceImages?: string[];
  serviceCategory?: string;
  effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean };
}

export function DetectiveSnippetGrid({
  snippetId,
  country,
  state,
  city,
  category,
  limit = 4,
}: DetectiveSnippetGridProps) {
  const [items, setItems] = useState<SnippetService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCategory, setResolvedCategory] = useState("");
  const [resolvedCountry, setResolvedCountry] = useState("");

  useEffect(() => {
    const fetchDetectives = async () => {
      try {
        setLoading(true);
        setError(null);

        const opts = { credentials: "include" as RequestCredentials };

        // If snippetId is provided, use it to fetch snippet details first
        let queryParams: Record<string, string | number | undefined> = {};

        if (snippetId) {
          const snippetRes = await fetch(`/api/snippets/${snippetId}`, opts);
          if (!snippetRes.ok) {
            const ct = snippetRes.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const body = await snippetRes.json().catch(() => ({}));
              const msg = (body as { error?: string })?.error || snippetRes.statusText;
              throw new Error(msg);
            }
            throw new Error(snippetRes.status === 404 ? "Snippet not found" : "Failed to load snippet");
          }
          const snippetData = await snippetRes.json().catch(() => ({}));
          const snippet = (snippetData as { snippet?: Record<string, unknown> })?.snippet;
          if (!snippet || typeof snippet !== "object") {
            throw new Error("Invalid snippet response");
          }
          const s = snippet as { country?: string; state?: string; city?: string; category?: string; limit?: number };
          queryParams = {
            country: s.country,
            state: s.state,
            city: s.city,
            category: s.category,
            limit: s.limit,
          };
          setResolvedCategory(String(s.category || ""));
          setResolvedCountry(String(s.country || ""));
        } else {
          if (!country || !category) {
            throw new Error("Either snippetId or both country and category are required");
          }
          queryParams = { country, state, city, category, limit };
          setResolvedCategory(String(category || ""));
          setResolvedCountry(String(country || ""));
        }

        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value != null && value !== "") params.append(key, String(value));
        });

        const detectivesRes = await fetch(`/api/snippets/detectives?${params.toString()}`, opts);
        if (!detectivesRes.ok) {
          const ct = detectivesRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const body = await detectivesRes.json().catch(() => ({}));
            const msg = (body as { error?: string })?.error || detectivesRes.statusText;
            throw new Error(msg);
          }
          throw new Error("Failed to load detectives");
        }

        const data = await detectivesRes.json().catch(() => ({}));
        const list = Array.isArray((data as { detectives?: unknown })?.detectives)
          ? (data as { detectives: SnippetService[] }).detectives
          : [];
        setItems(list);
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

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No services in this snippet yet</p>
      </div>
    );
  }

  const displayCountry = resolvedCountry || country || "";

  // Each item is one service: badges from effectiveBadges only (order: Verified → Blue Tick → Pro → Recommended)
  const serviceCards = items.map((item) => {
    const badgeState = computeServiceBadges({
      isVerified: item.isVerified,
      effectiveBadges: item.effectiveBadges,
    });
    return {
      id: item.serviceId,
      detectiveId: item.id,
      images: item.serviceImages && item.serviceImages.length > 0 ? item.serviceImages : undefined,
      avatar: item.profilePhoto || "",
      name: item.fullName,
      level: item.level.replace("level", "Level "),
      category: item.serviceCategory || resolvedCategory || category || "",
      badgeState,
      title: item.serviceTitle || item.serviceCategory || resolvedCategory || "Service",
      rating: item.avgRating,
      reviews: item.reviewCount,
      price: item.startingPrice,
      offerPrice: item.offerPrice ?? null,
      isOnEnquiry: item.isOnEnquiry,
      location: item.location,
      countryCode: item.country || displayCountry,
      phone: item.phone,
      whatsapp: item.whatsapp,
      contactEmail: item.contactEmail,
    };
  });

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
