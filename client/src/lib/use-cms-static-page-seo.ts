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

export function useCmsStaticPageSeo(slug: string, defaults: CmsStaticSeoDefaults) {
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
    retry: false,
    staleTime: 60_000,
  });

  return {
    title: data?.page?.metaTitle?.trim() || defaults.title,
    description: data?.page?.metaDescription?.trim() || defaults.description,
    h1: data?.page?.h1?.trim() || defaults.h1,
  };
}