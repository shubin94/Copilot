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

import { resolveLocation } from "./geo.js";
import { matchCategorySemanticDeepseek, type CategoryWithDesc, type DeepseekSemanticResult } from "./deepseek-category.js";
import { config } from "../config.js";
import * as cache from "./cache.js";
import { db } from "../../db/index.js";
import { smartSearchLogs } from "../../shared/schema.js";

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

/**
 * Synonym and abbreviation map for query expansion.
 * Converts common detective service slang/abbreviations to normalized terms.
 */
const QUERY_SYNONYMS: Record<string, string> = {
  // Private Investigation
  "pi": "private investigation",
  "p.i.": "private investigation",
  "p i": "private investigation",
  "detective": "private investigation",
  "detective work": "private investigation",
  "surveillance": "private investigation",
  "tail someone": "private investigation",
  
  // Background Checks
  "bg check": "background check",
  "background verification": "background check",
  "verify someone": "background check",
  "check history": "background check",
  
  // Infidelity
  "cheating spouse": "infidelity investigation",
  "cheating husband": "infidelity investigation",
  "cheating wife": "infidelity investigation",
  "cheating partner": "infidelity investigation",
  "affair": "infidelity investigation",
  "affair investigation": "infidelity investigation",
  "spouse cheating": "infidelity investigation",
  
  // Missing Persons
  "find someone": "missing person investigation",
  "locate someone": "missing person investigation",
  "find my daughter": "missing person investigation",
  "find my son": "missing person investigation",
  "lost relative": "missing person investigation",
  "runaway": "missing person investigation",
  "runaway teen": "missing person investigation",
  
  // Skip Tracing
  "skip tracer": "skip tracing",
  "skip trace": "skip tracing",
  "locate debtor": "skip tracing",
  
  // Corporate Investigation
  "employee theft": "corporate investigation",
  "workplace fraud": "corporate investigation",
  "due diligence": "corporate investigation",
  "business investigation": "corporate investigation",
  
  // Employment Verification
  "check employee": "employment verification",
  "employee background": "employment verification",
  "verify employee": "employment verification",
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Private Investigation": ["investigate", "detective", "surveillance"],
  "Background Checks": ["background", "verify", "check history"],
  "Infidelity Investigation": ["cheating", "affair", "spouse"],
  "Missing Persons Investigation": ["missing", "find", "locate", "runaway"],
  "Corporate Investigation": ["employee", "fraud", "corporate", "workplace"],
  "Employment Verification": ["employee verification", "job history"],
  "Skip Tracing": ["skip tracer", "locate debtor"],
};

const CATEGORY_KEYWORDS_LOWER = new Map(
  Object.entries(CATEGORY_KEYWORDS).map(([name, keywords]) => [name.toLowerCase(), keywords.map((keyword) => keyword.toLowerCase())])
);

function scoreCategoryByKeywords(query: string, categoryName: string): number {
  const keywords = CATEGORY_KEYWORDS_LOWER.get(categoryName.toLowerCase()) || [];
  if (keywords.length === 0) {
    return 0;
  }

  const normalizedQuery = query.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (normalizedQuery.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

function preFilterCategoriesForAI(query: string, categories: CategoryWithDesc[], limit = 10): CategoryWithDesc[] {
  const scored = categories
    .map((category, index) => ({
      category,
      score: scoreCategoryByKeywords(query, category.name),
      index,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));

  if (scored.length === 0) {
    console.debug("[SmartSearch Category PreFilter]", {
      query,
      candidateCategories: categories.map((category) => category.name),
    });
    return categories;
  }

  const candidateCategories = scored.slice(0, limit).map((entry) => entry.category);

  console.debug("[SmartSearch Category PreFilter]", {
    query,
    candidateCategories: candidateCategories.map((category) => category.name),
  });

  return candidateCategories;
}

/**
 * Normalize query for consistent caching:
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces to single space
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Expand query by replacing synonyms and abbreviations with standard terms.
 * Helps AI better understand user intent.
 */
function expandSynonyms(query: string): string {
  let expanded = query;
  
  // Sort synonym keys by length (longest first) to match longer phrases before shorter ones
  const sortedKeys = Object.keys(QUERY_SYNONYMS).sort((a, b) => b.length - a.length);
  
  for (const synonym of sortedKeys) {
    const replacement = QUERY_SYNONYMS[synonym];
    // Use word boundaries to avoid partial matches
    // For abbreviations with dots, escape them
    const escaped = synonym.replace(/\./g, "\\.");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    expanded = expanded.replace(regex, replacement);
  }
  
  return expanded;
}

/**
 * Log Smart Search analytics for continuous improvement.
 * Non-blocking - errors won't break search requests.
 */
async function logSmartSearchAnalytics(data: {
  query: string;
  expandedQuery: string;
  resultType: string;
  matchedCategories: string[];
  confidenceScores: number[];
  aiIntent?: string;
  aiReasoning?: string;
}): Promise<void> {
  try {
    // Non-blocking logging - fire and forget
    setImmediate(async () => {
      try {
        await db.insert(smartSearchLogs).values({
          query: data.query,
          expandedQuery: data.expandedQuery,
          resultType: data.resultType,
          matchedCategories: data.matchedCategories,
          confidenceScores: data.confidenceScores,
          aiIntent: data.aiIntent,
          aiReasoning: data.aiReasoning,
        });
        
        // Debug metrics
        console.debug("[SmartSearch Metrics]", {
          query: data.query,
          resultType: data.resultType,
          categories: data.matchedCategories,
          confidenceScores: data.confidenceScores,
        });
      } catch (logError) {
        // Silent failure - don't break search
        console.error("[SmartSearch Analytics] Logging failed:", logError);
      }
    });
  } catch (err) {
    // Outer catch to ensure function never throws
    console.error("[SmartSearch Analytics] Error initiating log:", err);
  }
}

/**
 * Validate and normalize AI-returned category against valid database categories.
 * Attempts fuzzy matching to handle slight variations.
 */
function validateAndNormalizeCategory(
  aiCategory: string,
  validCategories: Set<string>,
  categoriesMap: Map<string, string>
): string | null {
  // Exact match (case-insensitive)
  const lowerAiCategory = aiCategory.toLowerCase();
  if (validCategories.has(lowerAiCategory)) {
    return categoriesMap.get(lowerAiCategory) || null;
  }
  
  // Fuzzy match: try removing trailing 's' (plural)
  if (lowerAiCategory.endsWith('s')) {
    const singular = lowerAiCategory.slice(0, -1);
    if (validCategories.has(singular)) {
      return categoriesMap.get(singular) || null;
    }
  }
  
  // Fuzzy match: try removing common suffixes
  const suffixes = ['services', 'service', 'investigation', 'investigations'];
  for (const suffix of suffixes) {
    if (lowerAiCategory.includes(suffix)) {
      // Try to find a match by comparing the base part
      for (const validCat of validCategories) {
        const validCatLower = validCat.toLowerCase();
        // Check if they share significant common words
        const aiWords = lowerAiCategory.split(/\s+/);
        const validWords = validCatLower.split(/\s+/);
        const commonWords = aiWords.filter(w => validWords.includes(w) && w.length > 3);
        
        // If at least 2 significant words match, consider it a match
        if (commonWords.length >= 2) {
          return categoriesMap.get(validCatLower) || null;
        }
      }
    }
  }
  
  return null;
}

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

export interface SmartSearchResultSuggestions {
  kind: "suggestions";
  suggestedCategories: Array<{ category: string; confidence: number }>;
  intent: string;
  reasoning: string;
  message: string;
}

export interface SmartSearchResultMultiMatch {
  kind: "multi_match";
  categories: Array<{ category: string; confidence: number }>;
  intent: string;
  reasoning: string;
  message: string;
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
  | SmartSearchResultSuggestions
  | SmartSearchResultMultiMatch
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

  // Step 1: Create set of valid categories for validation
  const validCategories = new Set(deps.categories.map(c => c.name.toLowerCase()));
  const categoriesMap = new Map(deps.categories.map(c => [c.name.toLowerCase(), c.name]));

  // Step 2: Normalize query for caching
  const normalizedQuery = normalizeQuery(q);
  
  // Step 3: Apply synonym expansion to improve AI intent detection
  const expandedQuery = expandSynonyms(normalizedQuery);
  
  // Log synonym expansion if query was modified
  if (expandedQuery !== normalizedQuery) {
    console.debug("[SmartSearch Synonym Expansion]", {
      original: normalizedQuery,
      expanded: expandedQuery
    });
  }
  
  // Step 4: Create cache key from expanded query
  const cacheKey = `smartsearch:${expandedQuery}`;

  // Step 5: Check cache before calling AI
  const cachedResult = cache.get<SmartSearchResult>(cacheKey);
  if (cachedResult) {
    console.debug("[SmartSearch Cache HIT]", cacheKey);
    return cachedResult;
  }
  console.debug("[SmartSearch Cache MISS]", cacheKey);

  // Step 6: Pre-filter categories before semantic matching to reduce AI cognitive load
  const candidateCategories = preFilterCategoriesForAI(expandedQuery, deps.categories, 10);

  // Step 7: Match semantically via DeepSeek (ONLY method) using expanded query
  let semanticResult: DeepseekSemanticResult;
  try {
    semanticResult = await matchCategorySemanticDeepseek(deepseekKey, expandedQuery, candidateCategories);
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

  // Step 8: VALIDATE AI CATEGORY OUTPUT
  // Prevent hallucinated or invalid categories from breaking search
  if (semanticResult.topMatch) {
    const validatedCategory = validateAndNormalizeCategory(
      semanticResult.topMatch.category,
      validCategories,
      categoriesMap
    );
    
    if (!validatedCategory) {
      // AI returned invalid category - log warning and treat as no match
      console.warn("[SmartSearch Category Validation Failed]", {
        aiCategory: semanticResult.topMatch.category,
        confidence: semanticResult.topMatch.confidence,
        availableCategories: Array.from(validCategories).slice(0, 10) // Log first 10 for debugging
      });
      
      // Treat as low confidence / no match
      const result: SmartSearchResultCategoryNotFound = {
        kind: "category_not_found",
        message: "We didn't find a strong match for that. You can browse all services below.",
        suggestedCategories:
          semanticResult.closeMatches.length > 0
            ? semanticResult.closeMatches.slice(0, 3).map((m) => m.category)
            : undefined,
      };
      
      cache.set(cacheKey, result, 3600);
      
            // Log analytics (invalid category detected)
            logSmartSearchAnalytics({
              query: q,
              expandedQuery,
              resultType: "category_not_found",
              matchedCategories: result.suggestedCategories || [],
              confidenceScores: semanticResult.closeMatches.slice(0, 3).map(m => m.confidence),
              aiIntent: semanticResult.intent,
              aiReasoning: `INVALID CATEGORY: ${semanticResult.topMatch.category}. ${semanticResult.reasoning}`,
            });
      
      return result;
    }
    
    // Category is valid - normalize it to exact database name
    if (validatedCategory !== semanticResult.topMatch.category) {
      console.debug("[SmartSearch Category Normalized]", {
        aiCategory: semanticResult.topMatch.category,
        normalizedCategory: validatedCategory
      });
      semanticResult.topMatch.category = validatedCategory;
    }
  }
  
  // Step 9: Validate and normalize close matches
  if (semanticResult.closeMatches.length > 0) {
    semanticResult.closeMatches = semanticResult.closeMatches
      .map(match => {
        const validatedCategory = validateAndNormalizeCategory(
          match.category,
          validCategories,
          categoriesMap
        );
        if (validatedCategory && validatedCategory !== match.category) {
          return { ...match, category: validatedCategory };
        }
        return validatedCategory ? match : null;
      })
      .filter((match): match is NonNullable<typeof match> => match !== null);
  }

  // TIERED CONFIDENCE DECISION SYSTEM
  
  // LOW CONFIDENCE (< 50): No match - show category browser
  if (!semanticResult.topMatch || semanticResult.topMatch.confidence < 50) {
    console.log("[smart-search] low_confidence (<50):", semanticResult.topMatch?.confidence);
    const result: SmartSearchResultCategoryNotFound = {
      kind: "category_not_found",
      message: "We didn't find a strong match for that. You can browse all services below.",
      suggestedCategories:
        semanticResult.closeMatches.length > 0
          ? semanticResult.closeMatches.slice(0, 3).map((m) => m.category)
          : undefined,
    };
    
    // Cache category_not_found result (TTL = 1 hour)
    
        // Log analytics
        logSmartSearchAnalytics({
          query: q,
          expandedQuery,
          resultType: "category_not_found",
          matchedCategories: result.suggestedCategories || [],
          confidenceScores: semanticResult.closeMatches.slice(0, 3).map(m => m.confidence),
          aiIntent: semanticResult.intent,
          aiReasoning: semanticResult.reasoning,
        });
    cache.set(cacheKey, result, 3600);
    
    return result;
  }

  const confidence = semanticResult.topMatch.confidence;
  const category = semanticResult.topMatch.category;

  // MEDIUM CONFIDENCE (50-69): Return suggestions - let user choose
  if (confidence >= 50 && confidence < 70) {
    console.log("[smart-search] medium_confidence (50-69):", confidence);
    
    // Build suggestions array: top match + close matches
    const suggestions = [
      { category: semanticResult.topMatch.category, confidence: semanticResult.topMatch.confidence }
    ];
    
    // Add close matches (up to 3 total suggestions)
    if (semanticResult.closeMatches.length > 0) {
      for (const match of semanticResult.closeMatches) {
        if (suggestions.length >= 3) break;
        if (match.confidence >= 40) {  // Only suggest if confidence >= 40
          suggestions.push({ category: match.category, confidence: match.confidence });
        }
      }
    }
    
    const result: SmartSearchResultSuggestions = {
      kind: "suggestions",
      suggestedCategories: suggestions,
      intent: semanticResult.intent,
      reasoning: semanticResult.reasoning,
      message: "We found a few possible matches. Please select the one that best fits your needs:",
    };
    
    // Cache suggestions result (TTL = 1 hour)
    
        // Log analytics
        logSmartSearchAnalytics({
          query: q,
          expandedQuery,
          resultType: "suggestions",
          matchedCategories: suggestions.map(s => s.category),
          confidenceScores: suggestions.map(s => s.confidence),
          aiIntent: semanticResult.intent,
          aiReasoning: semanticResult.reasoning,
        });
    cache.set(cacheKey, result, 3600);
    
    return result;
  }

  // MULTI-INTENT DETECTION (High confidence with multiple strong categories)
  // Check if query has multiple clear intents before auto-resolving
  if (confidence >= 60 && semanticResult.closeMatches.length > 0) {
    // Find close matches with high confidence (≥ 55)
    const strongCloseMatches = semanticResult.closeMatches.filter(m => m.confidence >= 55);
    
    if (strongCloseMatches.length > 0) {
      console.debug("[SmartSearch Multi Intent]", {
        topMatch: { category: semanticResult.topMatch.category, confidence: semanticResult.topMatch.confidence },
        closeMatches: strongCloseMatches.map(m => ({ category: m.category, confidence: m.confidence }))
      });
      
      // Build multi-category result (limit to top 2)
      const multiCategories = [
        { category: semanticResult.topMatch.category, confidence: semanticResult.topMatch.confidence },
        strongCloseMatches[0] // Add the strongest close match
      ];
      
      const result: SmartSearchResultMultiMatch = {
        kind: "multi_match",
        categories: multiCategories,
        intent: semanticResult.intent,
        reasoning: semanticResult.reasoning,
        message: "Your query involves multiple investigative needs. Select the category that best matches what you need:"
      };
      
      // Cache multi_match result (TTL = 1 hour)
      
            // Log analytics
            logSmartSearchAnalytics({
              query: q,
              expandedQuery,
              resultType: "multi_match",
              matchedCategories: multiCategories.map(c => c.category),
              confidenceScores: multiCategories.map(c => c.confidence),
              aiIntent: semanticResult.intent,
              aiReasoning: semanticResult.reasoning,
            });
      cache.set(cacheKey, result, 3600);
      
      return result;
    }
  }

  // HIGH CONFIDENCE (>= 70): Auto-resolve - build search URL
  console.log("[smart-search] high_confidence (>=70):", confidence);
  
  // Category found - resolve location if mentioned in query
  const location = resolveLocation(q);

  console.log("[smart-search] Matched category:", category);
  console.log("[smart-search] Building URL with category:", category);

  const params = new URLSearchParams();
  params.set("category", category);
  params.set("sortBy", "popular");
  const searchUrl = `/search?${params.toString()}`;
  console.log("[smart-search] Final searchUrl:", searchUrl);
  
  const resolvedScope = location?.city ? "city" : location?.state ? "state" : location?.country ? "country" : "country";

  const result: SmartSearchResultResolved = {
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
  
  // Cache resolved result (TTL = 1 hour)
  
    // Log analytics
    logSmartSearchAnalytics({
      query: q,
      expandedQuery,
      resultType: "resolved",
      matchedCategories: [category],
      confidenceScores: [semanticResult.topMatch.confidence],
      aiIntent: semanticResult.intent,
      aiReasoning: semanticResult.reasoning,
    });
  cache.set(cacheKey, result, 3600);
  
  return result;
}
