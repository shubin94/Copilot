import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface PublicPageSeoResponse {
  page: {
    metaTitle?: string;
    metaDescription?: string;
    h1?: string;
  };
}

interface CmsStaticSeoDefaults {
  title: string;
  description: string;
  h1: string;
}

function normalizeCanonicalPath(href: string): string | null {
  try {
    const parsed = new URL(href, window.location.origin);
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function getHomepageSeoHeadSeed(): PublicPageSeoResponse | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const canonicalHref = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute("href")
    ?.trim();

  // Only trust head seed for the homepage canonical to avoid leaking stale
  // metadata when users client-navigate from non-home routes.
  if (!canonicalHref || normalizeCanonicalPath(canonicalHref) !== "/") {
    return null;
  }

  const title = document.title?.trim();
  const description = document
    .querySelector('meta[name="description"]')
    ?.getAttribute("content")
    ?.trim();

  if (!title || !description) {
    return null;
  }

  return {
    page: {
      metaTitle: title,
      metaDescription: description,
    },
  };
}

export function useCmsStaticPageSeo(slug: string, defaults: CmsStaticSeoDefaults) {
  const homepageHeadSeed = useMemo(
    () => (slug === "/" ? getHomepageSeoHeadSeed() : null),
    [slug],
  );

  const shouldFetchSeo = !(slug === "/" && homepageHeadSeed);

  const { data } = useQuery<PublicPageSeoResponse>({
    queryKey: ["public-static-page-seo", slug],
    queryFn: async () => {
      const encodedSlug = encodeURIComponent(slug);
      const response = await fetch(`/api/public/pages/${encodedSlug}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${slug} SEO`);
      }
      return response.json();
    },
    enabled: shouldFetchSeo,
    initialData: homepageHeadSeed ?? undefined,
    retry: false,
    staleTime: 60_000,
  });

  return {
    title: data?.page?.metaTitle?.trim() || defaults.title,
    description: data?.page?.metaDescription?.trim() || defaults.description,
    h1: data?.page?.h1?.trim() || defaults.h1,
  };
}