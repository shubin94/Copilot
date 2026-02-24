// ...component removed as requested...
/**
 * HomepageLocationGrid Component
 * 
 * Server-side rendered, SEO-friendly location browsing section for homepage.
 * Displays top countries, popular cities, and states in a clean grid layout.
 * 
 * Requirements:
 * - Flat grid layout (no nested indentation)
 * - Responsive: 3-4 columns desktop, 2 tablet, 1 mobile
 * - Max ~30 total links
 * - Standard <a> tags for crawlability
 * - SSR-friendly (no client-side data fetching)
 */

import { ArrowRight } from "lucide-react";
import { generateSlug } from "@/lib/slug-utils";

interface LocationLink {
  name: string;
  country?: string;
  state?: string;
  city?: string;
  detectiveCount: number;
}

interface HomepageLocationGridProps {
  topCountries: Array<{ country: string; detectiveCount: number }>;
  popularCities: Array<{ country: string; state: string; city: string; detectiveCount: number }>;
  topStates?: Array<{ country: string; state: string; detectiveCount: number }>;
}

/**
 * Generate detective location URL from components
 */
function buildLocationUrl(
  country?: string,
  state?: string,
  city?: string
): string {
  const parts: string[] = [];
  
  if (country) {
    parts.push(generateSlug(country));
  }
  if (state) {
    parts.push(generateSlug(state));
  }
  if (city) {
    parts.push(generateSlug(city));
  }

  return `/detectives/${parts.join("/")}`;
}

/**
 * Individual location link component
 */
function LocationLink({
  label,
  url,
  isPrimary = false,
}: {
  label: string;
  url: string;
  isPrimary?: boolean;
}) {
  return (
    <a
      href={url}
      className={`
        text-blue-600 hover:text-blue-800 hover:underline
        transition-colors duration-200
        inline-flex items-center gap-1
        ${isPrimary ? "font-semibold text-base" : "text-sm"}
      `}
    >
      {label}
      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

/**
 * Homepage Location Grid - Main Component
 * Displays location links in a clean, responsive grid
 */





// ...component removed as requested...
