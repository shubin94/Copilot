import { WORLD_COUNTRIES } from "./world-countries";

/**
 * Country code to country name mapping
 */
const countryCodeMap: Record<string, string> = WORLD_COUNTRIES.reduce(
  (acc, country) => {
    acc[country.code.toUpperCase()] = country.name;
    return acc;
  },
  { UK: "United Kingdom" } as Record<string, string>,
);

/**
 * Convert country code to full country name
 */
export function getCountryName(countryCode: string | undefined): string {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase().trim();
  return countryCodeMap[code] || countryCode; // Return full name or original value if no mapping
}

/**
 * Convert country name (or slug) back to country code
 * Handles both full names (e.g., "India") and slugs (e.g., "india")
 */
export function getCountryCode(countryNameOrSlug: string | undefined): string {
  if (!countryNameOrSlug) return '';
  
  // Normalize the input: convert to title case for comparison
  const normalized = countryNameOrSlug
    .toLowerCase()
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Find the country code by looking up the value in the map
  for (const [code, name] of Object.entries(countryCodeMap)) {
    if (name.toLowerCase() === normalized.toLowerCase()) {
      return code;
    }
  }
  
  // If not found, assume it's already a country code
  return countryNameOrSlug.toUpperCase();
}

/**
 * Generate a URL-friendly slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Format location parts for URL
 */
function formatLocationPart(part: string | undefined): string {
  if (!part) return '';
  return part
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

/**
 * Build a service URL from detective location and service slug
 * Format: /service/{country}/{state}/{city}/{detective-slug}/{service-slug}
 */
export function buildServiceUrl(
  detective: {
    country?: string | null;
    state?: string | null;
    city?: string | null;
    countrySlug?: string | null;
    stateSlug?: string | null;
    citySlug?: string | null;
    slug?: string | null;
    businessName?: string | null;
    [key: string]: any;
  } | null,
  service: { slug?: string | null; [key: string]: any } | null
): string {
  if (!detective || !service?.slug) return '/service';

  // Prefer canonical slugs from database payload.
  const country = formatLocationPart(detective.countrySlug ?? undefined) || formatLocationPart(getCountryName(detective.country ?? undefined));
  const state = formatLocationPart(detective.stateSlug ?? undefined) || formatLocationPart(detective.state ?? undefined) || 'region';
  const city = formatLocationPart(detective.citySlug ?? undefined) || formatLocationPart(detective.city ?? undefined) || 'area';

  // Use detective slug or generate from business name for uniqueness
  const detectiveSlug = detective.slug || (detective.businessName ? generateSlug(detective.businessName) : 'detective');

  // Remove UUID prefix from service slug if present
  const cleanSlug = service.slug?.replace(/^[0-9a-fA-F-]{36}-/, "");

  if (!country) return '/service';

  return `/service/${country}/${state}/${city}/${detectiveSlug}/${cleanSlug}`;
}

/**
 * Extract slug from URL path
 */
export function extractSlugFromPath(path: string): string | null {
  const match = path.match(/\/service\/[^\/]+\/[^\/]+\/[^\/]+\/([^/?]+)/);
  return match?.[1] || null;
}
