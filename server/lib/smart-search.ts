/**
 * Smart AI Search: Pure semantic, intent-based category matching via DeepSeek.
 * 
 * NO keyword matching, fuzzy matching, or regex patterns.
 * ONLY problem-to-solution reasoning from DeepSeek.
 * 
 * Process:
 * 1. User submits query
 * 2. Check prohibited keywords only (illegal activities)
 * 3. Send query + all categories WITH descriptions to DeepSeek
 * 4. DeepSeek analyzes user's INTENT and maps to categories by problem-solving fit
 * 5. Return top match with confidence scores
 */

import { resolveLocation } from "./geo.ts";
import { matchCategorySemanticDeepseek, type CategoryWithDesc, type DeepseekSemanticResult } from "./deepseek-category.ts";
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

export interface SmartSearchProhibitedResult {
  kind: "prohibited";
  message: string;
  alternativeCategory?: string;
}

export interface SmartSearchResultCategoryNotFound {
  kind: "category_not_found";
  message: string;
  suggestedCategories?: string[];
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
  intent: string; // User's actual problem/need
  confidence: number; // DeepSeek's confidence (0-100)
}

export type SmartSearchResult =
  | SmartSearchProhibitedResult
  | SmartSearchResultCategoryNotFound
  | SmartSearchResultNeedLocation
  | SmartSearchResultResolved;

export interface SmartSearchDeps {
  categories: CategoryWithDesc[]; // Full categories with descriptions
  checkAvailability: (opts: { category: string; country: string; state?: string; city?: string }) => Promise<number>;
}

/**
 * Run Smart Search - pure semantic intent matching.
 * 
 * NO keyword matching. Only problem-to-solution reasoning via DeepSeek.
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

  const deepseekKey = config.deepseek?.apiKey?.trim();
  if (!deepseekKey) {
    console.warn("[smart-search] No DeepSeek API key configured - pure semantic matching unavailable");
    console.warn("[smart-search] Add your DeepSeek API key in Admin → App Secrets to enable AI-powered category matching");
    return {
      kind: "category_not_found",
      message: "We didn't find any relevant category. You can browse all services below.",
    };
  }

  console.log("[smart-search] DeepSeek API key detected, using AI-powered category matching");

  // Match semantically via DeepSeek (ONLY method)
  let semanticResult: DeepseekSemanticResult;
  try {
    semanticResult = await matchCategorySemanticDeepseek(deepseekKey, q, deps.categories);
    console.log("[smart-search] semantic_result:", {
      intent: semanticResult.intent,
      topMatch: semanticResult.topMatch?.category,
      confidence: semanticResult.topMatch?.confidence,
      closeMatches: semanticResult.closeMatches.length,
    });
  } catch (error) {
    console.error("[smart-search] Semantic matching failed:", error);
    return {
      kind: "category_not_found",
      message: "We didn't find a relevant category. You can browse all services below.",
    };
  }

  // No match or low confidence
  if (!semanticResult.topMatch || semanticResult.topMatch.confidence < 50) {
    console.log("[smart-search] low_confidence:", semanticResult.topMatch?.confidence);
    return {
      kind: "category_not_found",
      message: "We didn't find a strong match for that. You can browse all services below.",
      suggestedCategories:
        semanticResult.closeMatches.length > 0
          ? semanticResult.closeMatches.slice(0, 3).map((m) => m.category)
          : undefined,
    };
  }

  // Category found - resolve location if mentioned in query
  const category = semanticResult.topMatch.category;
  const location = resolveLocation(q);

  console.log("[smart-search] Matched category:", category);
  console.log("[smart-search] Building URL with category:", category);

  const params = new URLSearchParams();
  params.set("category", category);
  params.set("sortBy", "popular");
  if (location?.country) {
    params.set("country", location.country);
    if (location.state) params.set("state", location.state);
  }
  const searchUrl = `/search?${params.toString()}`;
  console.log("[smart-search] Final searchUrl:", searchUrl);
  
  const resolvedScope = location?.city ? "city" : location?.state ? "state" : location?.country ? "country" : "country";

  return {
    kind: "resolved",
    category,
    resolvedLocationScope: resolvedScope,
    country: location?.country ?? "",
    state: location?.state,
    city: location?.city,
    searchUrl,
    intent: semanticResult.intent,
    confidence: semanticResult.topMatch.confidence,
  };
}
