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

  const locationPath = useMemo(
    () => [countrySlug, stateSlug, citySlug].filter(Boolean).join("/"),
    [countrySlug, stateSlug, citySlug],
  );

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
        const categoryCandidates = new Set<string>(popularCategories.filter(Boolean));

        if (categoryCandidates.size < MAX_LINKS) {
          const allCategories = await fetchActiveServiceCategories(controller.signal);
          allCategories.forEach((category) => categoryCandidates.add(category));
        }

        const candidates = Array.from(categoryCandidates).slice(0, 24);
        const validLinks: ServiceCategoryLink[] = [];

        for (const categoryName of candidates) {
          if (validLinks.length >= MAX_LINKS) break;
          const count = await fetchServiceLocationCategoryCount(
            categoryName,
            countrySlug,
            stateSlug,
            citySlug,
            controller.signal,
          );

          if (count > 0) {
            const categorySlug = generateSlug(categoryName);
            validLinks.push({
              categoryName,
              categorySlug,
              count,
              url: buildServiceLocationUrl(categorySlug, countrySlug, stateSlug, citySlug),
            });
          }
        }

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
      controller.abort();
    };
  }, [countrySlug, stateSlug, citySlug, locationPath]);

  if (!countrySlug || (!stateSlug && !citySlug && !locationDisplayName)) {
    return null;
  }

  if (!loading && links.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-gray-200" aria-labelledby="related-investigation-services-heading">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 id="related-investigation-services-heading" className="text-2xl font-bold text-gray-900">
            Popular Investigation Services in {locationDisplayName}
          </h2>
          <p className="text-gray-600 mt-2">
            Explore specialized private investigation services available in {locationDisplayName}.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 h-32" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {links.map((link) => (
              <Link key={link.categorySlug} href={link.url}>
                <a className="group block rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:bg-blue-50">
                  <div className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                    {link.categoryName}
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {link.count.toLocaleString()} services available
                  </div>
                  <div className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-800">
                    Explore {link.categoryName}
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
