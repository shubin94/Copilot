import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { ServiceCard } from "@/components/home/service-card";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";
import { computeServiceBadges } from "@/lib/service-badges";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getDetectiveProfileUrl } from "@/lib/utils";

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

type AutocompleteSuggestion = {
  type: "category" | "detective" | "location";
  label: string;
  value: string;
  meta?: string;
  // Detective location fields for direct URL building
  slug?: string;
  country?: string;
  state?: string;
  city?: string;
};

export function DetectiveSnippetGrid({
  snippetId,
  country,
  state,
  city,
  category,
  limit = 4,
}: DetectiveSnippetGridProps) {
  const normalizedSnippetId = snippetId?.trim();
  const [items, setItems] = useState<SnippetService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCategory, setResolvedCategory] = useState("");
  const [resolvedCountry, setResolvedCountry] = useState("");
  const [resolvedState, setResolvedState] = useState("");
  const [resolvedCity, setResolvedCity] = useState("");
  const [searchText, setSearchText] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchDetectives = async () => {
      try {
        setLoading(true);
        setError(null);

        const opts = { credentials: "include" as RequestCredentials };

        // If snippetId is provided, use it to fetch snippet details first
        let queryParams: Record<string, string | number | undefined> = {};

        if (normalizedSnippetId) {
          const snippetRes = await fetch(`/api/snippets/${normalizedSnippetId}`, opts);
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
          setResolvedState(String(s.state || ""));
          setResolvedCity(String(s.city || ""));
        } else {
          if (!country || !category) {
            throw new Error("Either snippetId or both country and category are required");
          }
          queryParams = { country, state, city, category, limit };
          setResolvedCategory(String(category || ""));
          setResolvedCountry(String(country || ""));
          setResolvedState(String(state || ""));
          setResolvedCity(String(city || ""));
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
  }, [normalizedSnippetId, country, state, city, category, limit]);

  useEffect(() => {
    const query = searchText.trim();
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray((data as { suggestions?: unknown })?.suggestions)
          ? (data as { suggestions: AutocompleteSuggestion[] }).suggestions
          : [];
        setSuggestions(list);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText]);

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
  const displayCategory = resolvedCategory || category || "";
  const displayState = resolvedState || state || "";
  const displayCity = resolvedCity || city || "";

  const applySuggestion = (suggestion: AutocompleteSuggestion | null) => {
    if (suggestion?.type === "detective") {
      // Navigate to detective profile using slug (no server redirect needed)
      setLocation(getDetectiveProfileUrl({ id: suggestion.value, slug: suggestion.slug, country: suggestion.country, state: suggestion.state, city: suggestion.city }));
      return;
    }
    if (suggestion?.type === "location" && suggestion.value.startsWith("country:")) {
      const countryCode = suggestion.value.replace("country:", "");
      setLocation(`/search?country=${countryCode}`);
      return;
    } else if (suggestion?.type === "category") {
      setLocation(`/search?category=${encodeURIComponent(suggestion.value)}`);
      return;
    }

    const value = suggestion?.label || searchText.trim();
    if (!value) return;
    const params = new URLSearchParams();
    params.set("q", value);
    setLocation(`/search?${params.toString()}`);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selected = activeIdx >= 0 && suggestions[activeIdx] ? suggestions[activeIdx] : null;
    applySuggestion(selected);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, -1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = activeIdx >= 0 && suggestions[activeIdx] ? suggestions[activeIdx] : null;
      applySuggestion(selected);
    }
  };

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
      category: item.serviceCategory || displayCategory,
      badgeState,
      title: item.serviceTitle || item.serviceCategory || displayCategory || "Service",
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
      detectiveCountry: item.country || displayCountry,
      detectiveState: resolvedState,
      detectiveCity: resolvedCity,
      detectiveSlug: item.id,
    };
  });

  return (
    <div className="space-y-6">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleSearchSubmit}>
        <div className="relative flex-1">
          <Input
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setActiveIdx(-1);
            }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder="Search within these results"
            aria-label="Search services"
          />
          {focused && suggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 text-gray-800 max-h-96 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.value}`}
                  onMouseDown={() => applySuggestion(suggestion)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${activeIdx === index ? "bg-gray-100" : ""} text-gray-800 flex items-center gap-2`}
                >
                  <span className="text-xs text-gray-500 uppercase font-semibold min-w-[60px]">
                    {suggestion.type === "category" ? "Category" : suggestion.type === "detective" ? "Detective" : "Location"}
                  </span>
                  <span className="flex-1">{suggestion.label}</span>
                  {suggestion.meta && <span className="text-xs text-gray-400">{suggestion.meta}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" className="sm:w-auto" disabled={loadingSuggestions && !searchText.trim()}>
          Search
        </Button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {serviceCards.map((card) => (
          <ServiceCard key={card.id} {...card} />
        ))}
      </div>
    </div>
  );
}
