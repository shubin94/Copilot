import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getCountryName } from "./slug-utils"

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
  businessName?: string | null;
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

  // Convert country code to full name, then slugify
  const countryName = getCountryName(detective.country);
  const countrySlug = generateSlug(countryName);
  const stateSlug = detective.state ? generateSlug(detective.state) : '';
  const citySlug = detective.city ? generateSlug(detective.city) : '';
  const detectiveSlug = detective.slug;

  // Build hierarchical URL
  // We must output exactly 4 location segments to match the routing regex
  if (!stateSlug || !citySlug) {
    return `/p/${detective.id}`;
  }

  return `/detectives/${countrySlug}/${stateSlug}/${citySlug}/${detectiveSlug}/`;
}

