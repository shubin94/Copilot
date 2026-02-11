import { Loader2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { usePopularCategories, useSiteSettings } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
// @ts-ignore
import heroBgPng from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.png";
// @ts-ignore
import heroBgWebp from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.webp";

type SmartSearchResult =
  | { kind: "prohibited"; message: string; alternativeCategory?: string }
  | { kind: "category_not_found"; message: string; suggestedCategories?: string[]; locationFilters?: { country?: string; state?: string } }
  | { kind: "need_location"; message: string; category: string }
  | { kind: "resolved"; category: string; resolvedLocationScope: string; country: string; state?: string; city?: string; searchUrl: string };

const SUGGESTED_PROMPTS = [
  "I need background verification for a marriage proposal in Mumbai",
  "Find a detective for pre-employment verification in Bangalore",
];

export function Hero() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const { data: popularData } = usePopularCategories();
  const { data: siteData } = useSiteSettings();
  const heroImage = siteData?.settings?.heroBackgroundImage;

  useEffect(() => {
    if (result && resultCardRef.current) {
      resultCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  const noMatchResult: SmartSearchResult = {
    kind: "category_not_found",
    message: "We didn't find any relevant categories. You can browse here to find what you need.",
  };

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q) {
      setLocation("/search");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await api.post<SmartSearchResult>("/api/smart-search", { query: q });
      const kind = data?.kind;
      if (kind === "prohibited" || kind === "category_not_found" || kind === "need_location" || kind === "resolved") {
        setResult(data as SmartSearchResult);
      } else {
        setResult({ ...noMatchResult, suggestedCategories: data?.suggestedCategories, locationFilters: data?.locationFilters });
      }
    } catch (_err) {
      setResult(noMatchResult);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseAll = () => {
    setResult(null);
    setLocation("/search");
  };

  const buildBrowseUrl = () => {
    if (!result || result.kind !== "category_not_found") return "/search";
    const lf = result.locationFilters;
    if (!lf?.country) return "/search";
    const params = new URLSearchParams();
    params.set("country", lf.country);
    if (lf.state) params.set("state", lf.state);
    return `/search?${params.toString()}`;
  };

  const getResolvedPlaceLabel = (r: Extract<SmartSearchResult, { kind: "resolved" }>) => {
    if (r.resolvedLocationScope === "city" && r.city) return r.city;
    if (r.resolvedLocationScope === "state" && r.state) return r.state;
    if (r.country) return r.country;
    return null; // no location provided
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gray-100 overflow-hidden">
      {/* Background Image with glossy overlay */}
      <div className="absolute inset-0 z-0">
        {heroImage ? (
          <img
            src={heroImage}
            alt=""
            fetchPriority="low"
            loading="lazy"
            decoding="async"
            className="object-cover w-full h-full"
          />
        ) : (
          <picture>
            <source srcSet={heroBgWebp} type="image/webp" />
            <img
              src={heroBgPng}
              alt=""
              fetchPriority="low"
              loading="lazy"
              decoding="async"
              className="object-cover w-full h-full"
            />
          </picture>
        )}
        <div className="absolute inset-0 bg-black/40" />
        {/* Glossy sheen: soft highlight sweep */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.1) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 flex flex-col items-center max-w-3xl w-full py-8 md:py-12">
        {/* Page title and header text – above the card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full text-center mb-12 mt-8 md:mt-12"
        >
          <h1 className="text-3xl md:text-5xl font-bold font-heading text-white leading-tight">
            Find the perfect <i className="font-serif font-light text-green-400">private detective</i>
            <br />
            for your investigation.
          </h1>
        </motion.div>

        {/* Floating card – reference style */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Soft gradient strip at top */}
          <div className="h-1 w-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />

          <div className="p-6 md:p-8">
            {/* Header row: tagline left, attribution right */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-base font-semibold text-gray-900">
                  Find the right detective for your situation
                </span>
              </div>
              <span className="text-sm text-gray-500">Smart search</span>
            </div>

            {/* Large text box – full width */}
            <div className="mb-4">
              <textarea
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 text-gray-900 text-base p-4 placeholder:text-gray-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 resize-y min-h-[100px] transition-shadow focus:bg-white"
                placeholder="Type your situation and we'll match you with the right service and location..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                data-testid="input-smart-search"
              />
            </div>

            {/* Find services button + Browse all services link – centered, side by side */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="h-12 px-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-shadow disabled:opacity-90 disabled:bg-green-600 disabled:hover:bg-green-600"
                data-testid="button-submit-smart-search"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Find services
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={handleBrowseAll}
                className="text-sm text-gray-500 hover:text-green-600 font-medium transition-colors"
                data-testid="link-browse-all"
              >
                Browse all services →
              </button>
            </div>
          </div>
        </motion.div>

        {/* Popular categories – chips; hidden when result is shown */}
        {!result && (popularData?.categories?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full mt-4 flex flex-wrap justify-center gap-2"
          >
            <span className="text-sm text-white/80 mr-1 self-center">Popular:</span>
            {((popularData?.categories || []).map((c: { category: string }) => c.category))
              .slice(0, 2)
              .map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => setLocation(`/search?category=${encodeURIComponent(tag)}`)}
                  className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm font-medium border border-white/30 transition-colors"
                >
                  {tag}
                </button>
              ))}
          </motion.div>
        )}

        {/* Result states – shown after "Find services"; replaces suggestions */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              ref={resultCardRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full mt-6 rounded-2xl overflow-hidden text-gray-900 bg-white/95 backdrop-blur-md border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
            >
              <div className="h-1 w-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 shrink-0" />
              <div className="p-6 bg-gradient-to-b from-white/50 to-white/90">
              {result.kind === "prohibited" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-base">{result.message}</p>
                  </div>
                  {result.alternativeCategory && (
                    <p className="text-sm text-gray-600">
                      A legal option we offer: <strong>{result.alternativeCategory}</strong>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleBrowseAll}
                    className="text-green-700 font-medium underline underline-offset-2 hover:no-underline text-sm"
                  >
                    Browse legal services →
                  </button>
                </div>
              )}

              {result.kind === "category_not_found" && (
                <div className="space-y-3">
                  <p className="text-base">
                    {result.suggestedCategories?.length ? `This service category might help you: ${result.suggestedCategories[0]}. View it or browse all below.` : (result.message || "We didn't find an exact match. Browse our services to find what you need.")}
                  </p>
                  {result.suggestedCategories && result.suggestedCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => setLocation(`/search?category=${encodeURIComponent(result.suggestedCategories![0])}`)}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                        data-testid="button-view-suggested-category"
                      >
                        View {result.suggestedCategories[0]} <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button variant="outline" onClick={() => setLocation(buildBrowseUrl())} className="rounded-xl">
                        Browse all services
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setLocation(buildBrowseUrl())}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                      data-testid="button-browse-all-services"
                    >
                      Browse all services
                    </Button>
                  )}
                </div>
              )}

              {result.kind === "need_location" && (
                <div className="space-y-3">
                  <p className="text-base">
                    This service category can actually help you: <strong>{result.category}</strong>. Add your city or country to see detectives near you, or view all {result.category} services below.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setLocation(`/search?category=${encodeURIComponent(result.category)}`)}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                      data-testid="button-view-category"
                    >
                      View {result.category} services <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={handleBrowseAll} className="rounded-xl">
                      Browse all services
                    </Button>
                  </div>
                </div>
              )}

              {result.kind === "resolved" && (() => {
                const place = getResolvedPlaceLabel(result);
                return (
                  <div className="space-y-3">
                    <p className="text-base">
                      This service category can help you: <strong>{result.category}</strong>.
                      {place ? <> We have detectives in <strong>{place}</strong>. Click below to see them.</> : <> Click below to browse this service.</>}
                    </p>
                    <Button
                      onClick={() => setLocation(result.searchUrl)}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                      data-testid="button-view-results"
                    >
                      View {result.category} services <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                );
              })()}

              {/* Fallback: unknown result kind – show no-results message and browse button */}
              {result && !["prohibited", "category_not_found", "need_location", "resolved"].includes(result.kind) && (
                <div className="space-y-3">
                  <p className="text-base">
                    We didn't find any relevant categories. You can browse here to find what you need.
                  </p>
                  <Button
                    onClick={() => setLocation(buildBrowseUrl())}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                    data-testid="button-browse-all-services"
                  >
                    Browse all services
                  </Button>
                </div>
              )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
