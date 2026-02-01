/**
 * Smart AI Search: prohibited check, category matching (existing only), location resolution.
 * Uses Gemini when GEMINI_API_KEY is set to understand user text; otherwise keyword match.
 */

import { resolveLocation } from "./geo.ts";
import { matchCategoryWithGemini } from "./gemini-category.ts";
import { config } from "../config.ts";

const PROHIBITED_KEYWORDS = [
  "phone tap", "phone tapping", "tap phone", "tap his phone", "tap her phone",
  "listen to calls", "listen to phone calls", "eavesdrop", "wiretap",
  "hack", "hacking", "hack into", "hack account", "hack email", "hack phone",
  "spy on", "spying on", "spy on phone", "spy on messages",
  "track without consent", "track someone without", "track her", "track him", "gps track without",
  "private messages", "access private messages", "read private messages",
  "private emails", "access emails", "read emails without",
  "call logs", "access call logs", "call history without",
  "illegal surveillance", "unauthorized surveillance",
];

const PROHIBITED_LEGAL_ALTERNATIVE = "Legal background verification";

function isProhibited(query: string): boolean {
  const q = query.toLowerCase().trim();
  for (const kw of PROHIBITED_KEYWORDS) {
    if (q.includes(kw.toLowerCase())) return true;
  }
  return false;
}

// Explicit phrase -> category name (when that category exists in the list)
const PHRASE_TO_CATEGORY: [RegExp, string][] = [
  [/missing\s+person|find\s+(a\s+)?(missing\s+)?person|find\s+(a\s+)?missing|locate\s+missing|missing\s+people|trace\s+(a\s+)?person|locate\s+(a\s+)?person/i, "Missing Persons"],
  [/monitor\w*\s+(my\s+)?(kid|child|children)|watch\s+my\s+kid/i, "Monitoring"],
  [/monitoring/i, "Monitoring"],
];

/**
 * Match user query to exactly one existing category name (keyword/substring match).
 * Returns category name or null if no match; optional suggestedCategories for low confidence.
 * Word overlap (e.g. "monitor" in query -> "Monitoring" category) is treated as a match.
 */
function matchCategory(
  query: string,
  categoryNames: string[]
): { category: string | null; suggestedCategories: string[] } {
  const q = query.toLowerCase().trim();

  // Explicit phrases (e.g. "missing person" -> Missing Persons)
  for (const [regex, preferredName] of PHRASE_TO_CATEGORY) {
    if (!regex.test(q)) continue;
    const found = categoryNames.find((n) => n.toLowerCase() === preferredName.toLowerCase());
    if (found) return { category: found, suggestedCategories: [] };
  }

  const matched: string[] = [];
  for (const name of categoryNames) {
    const n = name.toLowerCase();
    if (q.includes(n) || n.includes(q)) matched.push(name);
  }
  if (matched.length === 1) return { category: matched[0], suggestedCategories: [] };
  if (matched.length > 1) {
    matched.sort((a, b) => b.length - a.length);
    return { category: matched[0], suggestedCategories: matched.slice(1, 4) };
  }
  // Word overlap: e.g. "monitor" / "monitoring" in query -> "Monitoring" category
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const suggested = categoryNames.filter((name) => {
    const n = name.toLowerCase();
    return words.some((w) => n.includes(w) || n.includes(w + "s") || (w.length >= 4 && n.startsWith(w)));
  });
  // If we have a clear word match (e.g. "monitor" -> "Monitoring"), treat it as the category
  if (suggested.length >= 1) {
    const best = suggested.slice().sort((a, b) => b.length - a.length)[0];
    return { category: best, suggestedCategories: suggested.filter((c) => c !== best).slice(0, 3) };
  }
  return { category: null, suggestedCategories: [] };
}

export interface SmartSearchProhibitedResult {
  kind: "prohibited";
  message: string;
  alternativeCategory?: string;
}

export interface SmartSearchResultCategoryNotFound {
  kind: "category_not_found";
  message: string;
  suggestedCategories?: string[];
  /** If user mentioned location, pass through for "Browse all services" button */
  locationFilters?: { country?: string; state?: string };
}

export interface SmartSearchResultNeedLocation {
  kind: "need_location";
  message: string;
  category: string;
}

export interface SmartSearchResultResolved {
  kind: "resolved";
  category: string;
  resolvedLocationScope: "city" | "state" | "country";
  country: string;
  state?: string;
  city?: string;
  searchUrl: string;
}

export type SmartSearchResult =
  | SmartSearchProhibitedResult
  | SmartSearchResultCategoryNotFound
  | SmartSearchResultNeedLocation
  | SmartSearchResultResolved;

export interface SmartSearchDeps {
  categoryNames: string[];
  checkAvailability: (opts: { category: string; country: string; state?: string; city?: string }) => Promise<number>;
}

/**
 * Run Smart Search logic: prohibited -> category match -> location -> availability cascade.
 */
export async function runSmartSearch(query: string, deps: SmartSearchDeps): Promise<SmartSearchResult> {
  const q = (query || "").trim();
  if (!q) {
    return { kind: "category_not_found", message: "We didn't find any relevant categories. You can browse here to find what you need." };
  }

  if (isProhibited(q)) {
    return {
      kind: "prohibited",
      message:
        "We don't provide services that involve illegal activities or violation of privacy, as they are restricted under government laws.",
      alternativeCategory: PROHIBITED_LEGAL_ALTERNATIVE,
    };
  }

  let category: string | null = null;
  let suggestedCategories: string[] = [];
  const geminiKey = config.gemini?.apiKey?.trim();

  if (geminiKey) {
    // Use only Gemini for category matching when configured
    const geminiResult = await matchCategoryWithGemini(geminiKey, q, deps.categoryNames);
    category = geminiResult.category;
    suggestedCategories = geminiResult.suggestedCategories ?? [];
    // If Gemini says no match → fallback to "browse all services" (no keyword fallback)
    if (!category) {
      return {
        kind: "category_not_found",
        message: "We didn't find a relevant category for that. You can browse all services below.",
        suggestedCategories: suggestedCategories.length > 0 ? suggestedCategories : undefined,
      };
    }
  } else {
    // No Gemini: use keyword match; if no match → browse all services
    const keywordResult = matchCategory(q, deps.categoryNames);
    category = keywordResult.category;
    suggestedCategories = keywordResult.suggestedCategories ?? [];
    if (!category) {
      return {
        kind: "category_not_found",
        message: "We didn't find a relevant category for that. You can browse all services below.",
        suggestedCategories: suggestedCategories.length > 0 ? suggestedCategories : undefined,
      };
    }
  }

  // Category found. Location is optional: build searchUrl with category, add location only if user mentioned it
  const location = resolveLocation(q);
  const params = new URLSearchParams();
  params.set("category", category);
  if (location?.country) {
    params.set("country", location.country);
    if (location.state) params.set("state", location.state);
  }
  const searchUrl = `/search?${params.toString()}`;

  const resolvedScope = location?.city ? "city" : location?.state ? "state" : location?.country ? "country" : undefined;
  return {
    kind: "resolved",
    category,
    resolvedLocationScope: resolvedScope ?? "country",
    country: location?.country ?? "",
    state: location?.state,
    city: location?.city,
    searchUrl,
  };
}
