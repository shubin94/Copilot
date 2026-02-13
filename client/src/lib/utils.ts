import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper to generate slug from text
export function generateSlug(text: string): string {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

// Interface for detective profile data (flexible for various API responses)
interface DetectiveProfileData {
  id: string;
  slug?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
}

/**
 * Build detective profile URL with graceful fallbacks
 * Returns SEO-friendly URL: /detectives/{country}/{state}/{city}/{slug}/
 * Falls back to shorter URLs if location data missing
 * Falls back to /p/{id} redirect if slug missing
 */
export function getDetectiveProfileUrl(detective: DetectiveProfileData): string {
  // Fallback to legacy redirect if no slug
  if (!detective.slug) {
    return `/p/${detective.id}`;
  }

  // Must have at least country
  if (!detective.country) {
    return `/p/${detective.id}`;
  }

  const countrySlug = generateSlug(detective.country);
  const stateSlug = detective.state ? generateSlug(detective.state) : '';
  const citySlug = detective.city ? generateSlug(detective.city) : '';
  const detectiveSlug = detective.slug;

  // Build hierarchical URL
  if (citySlug && stateSlug) {
    // Full path: country/state/city/detective
    return `/detectives/${countrySlug}/${stateSlug}/${citySlug}/${detectiveSlug}/`;
  } else if (stateSlug) {
    // State-level: country/state/detective (city missing)
    return `/detectives/${countrySlug}/${stateSlug}/${detectiveSlug}/`;
  } else {
    // Country-level: country/detective (state & city missing)
    return `/detectives/${countrySlug}/${detectiveSlug}/`;
  }
}

