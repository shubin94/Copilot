import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { generateSlug } from "@/lib/utils";

interface RelatedInvestigationServicesProps {
  countrySlug: string;
  stateSlug?: string;
  citySlug?: string;
  locationDisplayName: string;
}

interface ServiceCategoryLink {
  categoryName: string;
  categorySlug: string;
  url: string;
  count: number;
}

const MAX_LINKS = 6;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_CANDIDATES_TO_CHECK = 12;

const RELEVANT_CATEGORY_TERMS = [
  "background",
  "surveillance",
  "matrimonial",
  "investigation",
  "verification",
  "verify",
  "asset",
  "fraud",
  "skip tracing",
  "skip-tracing",
  "missing person",
  "missing persons",
  "infidelity",
  "due diligence",
  "employee",
  "employment",
  "litigation",
  "tracing",
  "corporate",
];

const BLOCKED_CATEGORY_TERMS = [
  "cyber",
  "security",
  "technical",
  "software",
  "cloud",
  "network",
  "web",
  "app",
  "marketing",
  "seo",
  "enterprise",
  "database",
  "hosting",
  "support",
  "hardware",
];

const titleCase = (value: string): string => {
  return value
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const isRelevantInvestigationCategory = (categoryName: string): boolean => {
  const normalized = categoryName.toLowerCase().trim();

  if (BLOCKED_CATEGORY_TERMS.some((term) => normalized.includes(term))) {
    return false;
  }

  return RELEVANT_CATEGORY_TERMS.some((term) => normalized.includes(term));
};

const STABLE_FALLBACK_CATEGORIES = [
  "Background Checks",
  "Surveillance",
  "Asset Search",
  "Matrimonial Investigation",
  "Fraud Investigation",
];

const buildServiceLocationUrl = (
  categorySlug: string,
  countrySlug: string,
  stateSlug?: string,
  citySlug?: string,
) => {
  const pathSegments = [countrySlug, stateSlug, citySlug].filter(Boolean).map(encodeURIComponent);
  return `/locations/${encodeURIComponent(categorySlug)}/${pathSegments.join("/")}/`;
};

const fetchServiceLocationCategoryCount = async (
  categoryName: string,
  countrySlug: string,
  stateSlug?: string,
  citySlug?: string,
  signal?: AbortSignal,
): Promise<number> => {
  const categorySlug = generateSlug(categoryName);
  if (!categorySlug || !countrySlug) {
    return 0;
  }

  const segments = [
    "/api/services",
    encodeURIComponent(categorySlug),
    encodeURIComponent(countrySlug),
    stateSlug ? encodeURIComponent(stateSlug) : undefined,
    citySlug ? encodeURIComponent(citySlug) : undefined,
  ].filter(Boolean);

  const url = `${segments.join("/")}?limit=1`;
  const response = await fetch(url, { signal, credentials: "include" });

  if (!response.ok) {
    return 0;
  }

  const data = await response.json();
  return typeof data?.meta?.total === "number" ? data.meta.total : 0;
};

const fetchPopularServiceCategories = async (signal?: AbortSignal): Promise<string[]> => {
  const response = await fetch("/api/popular-categories", { signal, credentials: "include" });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  if (!Array.isArray(data?.categories)) {
    return [];
  }
  return data.categories
    .map((item: any) => (typeof item?.category === "string" ? item.category : ""))
    .filter(Boolean);
};

const fetchActiveServiceCategories = async (signal?: AbortSignal): Promise<string[]> => {
  const response = await fetch("/api/service-categories?activeOnly=true", { signal, credentials: "include" });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  if (!Array.isArray(data?.categories)) {
    return [];
  }
  return data.categories
    .map((item: any) => (typeof item?.name === "string" ? item.name : ""))
    .filter(Boolean);
};

export function RelatedInvestigationServices({
  countrySlug,
  stateSlug,
  citySlug,
  locationDisplayName,
}: RelatedInvestigationServicesProps) {
  const [links, setLinks] = useState<ServiceCategoryLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const displayLocationName = titleCase(locationDisplayName);

  const locationPath = useMemo(
    () => [countrySlug, stateSlug, citySlug].filter(Boolean).join("/"),
    [countrySlug, stateSlug, citySlug],
  );

  const fallbackLinks = useMemo<ServiceCategoryLink[]>(() => {
    return STABLE_FALLBACK_CATEGORIES.map((categoryName) => {
      const categorySlug = generateSlug(categoryName);
      return {
        categoryName,
        categorySlug,
        count: 0,
        url: buildServiceLocationUrl(categorySlug, countrySlug, stateSlug, citySlug),
      };
    });
  }, [countrySlug, stateSlug, citySlug]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const loadRelatedCategories = async () => {
      if (!countrySlug || !locationPath) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const popularCategories = await fetchPopularServiceCategories(controller.signal);
        const categoryCandidates = new Set<string>(
          popularCategories.filter((category) => category && isRelevantInvestigationCategory(category)),
        );

        if (categoryCandidates.size < MAX_LINKS) {
          const allCategories = await fetchActiveServiceCategories(controller.signal);
          allCategories
            .filter((category) => category && isRelevantInvestigationCategory(category))
            .forEach((category) => categoryCandidates.add(category));
        }

        const candidates = Array.from(categoryCandidates).slice(0, MAX_CANDIDATES_TO_CHECK);
        const counted = await Promise.all(
          candidates.map(async (categoryName) => {
            const count = await fetchServiceLocationCategoryCount(
              categoryName,
              countrySlug,
              stateSlug,
              citySlug,
              controller.signal,
            );

            return { categoryName, count };
          }),
        );

        const validLinks: ServiceCategoryLink[] = counted
          .filter((entry) => entry.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, MAX_LINKS)
          .map(({ categoryName, count }) => {
            const categorySlug = generateSlug(categoryName);
            return {
              categoryName,
              categorySlug,
              count,
              url: buildServiceLocationUrl(categorySlug, countrySlug, stateSlug, citySlug),
            };
          });

        if (active) {
          setLinks(validLinks);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("RelatedInvestigationServices error:", err);
        if (active) {
          setError("Unable to load related investigation services right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRelatedCategories();

    return () => {
      active = false;
      clearTimeout(timeout);
      try {
        controller.abort();
      } catch (err) {
        // Ignore abort errors (controller may already be aborted)
      }
    };
  }, [countrySlug, stateSlug, citySlug, locationPath]);

  if (!countrySlug || (!stateSlug && !citySlug && !locationDisplayName)) {
    return null;
  }

  const displayLinks = links.length > 0 ? links : fallbackLinks;

  return (
    <section className="mt-12 pt-8 border-t border-gray-200" aria-labelledby="related-investigation-services-heading">
      <div>
        <div className="mb-6">
          <h2 id="related-investigation-services-heading" className="text-2xl font-bold text-gray-900">
            Popular Investigation Services in {displayLocationName}
          </h2>
          <p className="text-gray-600 mt-2">
            Explore specialized private investigation services available in {displayLocationName}.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayLinks.map((link) => (
              <Link
                key={link.categorySlug}
                href={link.url}
                className="group block rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100"
              >
                  <div className="text-sm font-semibold text-gray-900">
                    {link.categoryName}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {link.count > 0 ? `${link.count.toLocaleString()} services available` : ""}
                  </div>
                  <div className="mt-2 inline-flex items-center text-xs font-medium text-gray-700">
                    Explore {link.categoryName}
                  </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
