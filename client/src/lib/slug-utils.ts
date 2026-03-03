/**
 * Country code to country name mapping
 */
const countryCodeMap: Record<string, string> = {
  'IN': 'India',
  'US': 'United States',
  'UK': 'United Kingdom',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'NZ': 'New Zealand',
  'IE': 'Ireland',
  'SG': 'Singapore',
  'MY': 'Malaysia',
  'PH': 'Philippines',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'ZA': 'South Africa',
  'AE': 'United Arab Emirates',
  'KW': 'Kuwait',
  'SA': 'Saudi Arabia',
  'QA': 'Qatar',
  'OM': 'Oman',
  'JP': 'Japan',
  'CN': 'China',
  'HK': 'Hong Kong',
  'MX': 'Mexico',
  'BR': 'Brazil',
  'AR': 'Argentina',
  'CL': 'Chile',
};

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
  detective: { country?: string | null; state?: string | null; city?: string | null; slug?: string | null; businessName?: string | null; [key: string]: any } | null,
  service: { slug?: string | null; [key: string]: any } | null
): string {
  if (!detective || !service?.slug) return '/service';
  
  // Convert country code to full name (convert null to undefined)
  const country = formatLocationPart(getCountryName(detective.country ?? undefined));
  // Use full state and city names (already in full form)
  const state = formatLocationPart(detective.state ?? undefined) || 'region';
  const city = formatLocationPart(detective.city ?? undefined) || 'area';
  
  // Use detective slug or generate from business name for uniqueness
  const detectiveSlug = detective.slug || (detective.businessName ? generateSlug(detective.businessName) : 'detective');
  
  if (!country) return '/service';
  
  return `/service/${country}/${state}/${city}/${detectiveSlug}/${service.slug}`;
}

/**
 * Extract slug from URL path
 */
export function extractSlugFromPath(path: string): string | null {
  const match = path.match(/\/service\/[^\/]+\/[^\/]+\/[^\/]+\/([^/?]+)/);
  return match?.[1] || null;
}
