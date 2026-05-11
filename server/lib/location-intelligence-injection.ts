/**
 * Shared utilities for LocationIntelligence SSR injection
 * Used by both index-prod.ts and index-dev.ts for consistency
 */

import { getCountryContent, isCountryEnabled, getStateContent, isStateEnabled } from "../config/countryContent.js";

export interface Detective {
  updatedAt?: string | null;
  [key: string]: any;
}

export interface LocationIntelligencePayload {
  level: "country" | "state";
  country: string;
  state?: string;
  countryName: string;
  stateName?: string;
  detectiveCount: number;
  topServices: string[];
  lastUpdated?: string;
  content: any;
}

export interface LocationIntelligenceInjectionResult {
  payload: LocationIntelligencePayload | null;
  script: string;
}

/**
 * Derive real lastUpdated from the most recently updated detective
 * Returns ISO 8601 timestamp or undefined if no updatedAt data available
 */
export function getLastUpdatedFromDetectives(detectives: Detective[]): string | undefined {
  const mostRecentDetective = detectives.reduce<Detective | null>(
    (latest, d) => {
      if (!latest) return d;
      const dTime = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
      const lTime = latest.updatedAt ? new Date(latest.updatedAt).getTime() : 0;
      return dTime > lTime ? d : latest;
    },
    null
  );
  
  return mostRecentDetective?.updatedAt
    ? new Date(mostRecentDetective.updatedAt).toISOString()
    : undefined;
}

/**
 * Build LocationIntelligence payload for country-level pages
 */
export function buildCountryLevelPayload(
  countrySlug: string,
  countryName: string,
  detectiveCount: number,
  detectives: Detective[]
): LocationIntelligencePayload | null {
  if (!isCountryEnabled(countrySlug)) return null;
  
  const countryContent = getCountryContent(countrySlug);
  if (!countryContent) return null;
  
  const realLastUpdated = getLastUpdatedFromDetectives(detectives);
  
  return {
    level: "country",
    country: countrySlug,
    countryName: countryName || countrySlug.replace(/-/g, " "),
    detectiveCount,
    topServices: [],
    ...(realLastUpdated ? { lastUpdated: realLastUpdated } : {}),
    content: countryContent,
  };
}

/**
 * Build LocationIntelligence payload for state-level pages
 */
export function buildStateLevelPayload(
  countrySlug: string,
  stateSlug: string,
  countryName: string,
  stateName: string,
  detectiveCount: number,
  detectives: Detective[]
): LocationIntelligencePayload | null {
  const stateContent = isStateEnabled(countrySlug, stateSlug)
    ? getStateContent(countrySlug, stateSlug)
    : undefined;
  const fallbackCountryContent = getCountryContent(countrySlug);
  const content = stateContent ?? fallbackCountryContent;
  if (!content) return null;
  
  const realLastUpdated = getLastUpdatedFromDetectives(detectives);
  
  return {
    level: "state",
    country: countrySlug,
    state: stateSlug,
    countryName: countryName || countrySlug.replace(/-/g, " "),
    stateName: stateName || stateSlug.replace(/-/g, " "),
    detectiveCount,
    topServices: [],
    ...(realLastUpdated ? { lastUpdated: realLastUpdated } : {}),
    content,
  };
}

/**
 * Determine page level from route params
 */
export function getPageLevel(params: { state?: string; city?: string }): "country" | "state" | "city" | null {
  if (!params.state && !params.city) return "country";
  if (params.state && !params.city) return "state";
  if (params.state && params.city) return "city";
  return null;
}

/**
 * Generate LocationIntelligence injection for HTML head
 * Handles both production (Vite injection) and development (dev server) modes
 */
export function generateLocationIntelligenceScript(
  payload: LocationIntelligencePayload | null,
  mode: "prod" | "dev" = "prod"
): string {
  if (!payload) return "";
  
  const jsonStr = mode === "prod"
    ? JSON.stringify(payload)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029")
    : JSON.stringify(payload);
  
  return `<script>\n  window.LOCATION_INTELLIGENCE = ${jsonStr};\n</script>`;
}
