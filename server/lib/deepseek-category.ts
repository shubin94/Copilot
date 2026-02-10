/**
 * Semantic-only category matching: pure intent-based analysis via DeepSeek.
 * No keyword/fuzzy/regex matching. Only problem-to-solution reasoning.
 * 
 * Process:
 * 1. Analyze user's actual problem/intent (not their words)
 * 2. Map intent to categories that solve the problem
 * 3. Return confidence scores for best matches
 * 4. Return "no clear match" if intent doesn't align with any category
 */

const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export interface CategoryWithDesc {
  id: string;
  name: string;
  description: string | null;
}

export interface DeepseekSemanticResult {
  intent: string; // User's actual problem/intent
  topMatch: { category: string; confidence: number } | null; // Best match (>70% confidence)
  closeMatches: Array<{ category: string; confidence: number }>; // Secondary options if user unsure
  reasoning: string; // Why this match
}

/**
 * Sanitize inputs to prevent encoding issues.
 */
function sanitizeForAI(input: string): string {
  let sanitized = input.normalize('NFC');
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');
  return sanitized;
}

/**
 * Pure semantic category matching via DeepSeek.
 * 
 * Input: User query + all categories with descriptions
 * Process: DeepSeek analyzes user's ACTUAL PROBLEM/INTENT (not keywords)
 * Output: Intent statement + top category matches with confidence scores
 * 
 * NO keyword matching at all - purely semantic reasoning.
 */
export async function matchCategorySemanticDeepseek(
  apiKey: string,
  userQuery: string,
  categories: CategoryWithDesc[]
): Promise<DeepseekSemanticResult> {
  if (!apiKey.trim() || categories.length === 0) {
    return {
      intent: userQuery,
      topMatch: null,
      closeMatches: [],
      reasoning: "No API key or categories available",
    };
  }

  const cleanQuery = sanitizeForAI(userQuery);
  
  // Build category reference with descriptions
  const categoryList = categories
    .map((c) => `"${sanitizeForAI(c.name)}" - ${sanitizeForAI(c.description || 'No description')}`)
    .join("\n");

  const escapedQuery = cleanQuery.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const prompt = sanitizeForAI([
    'You are an expert at understanding customer needs and matching them to appropriate services.',
    '',
    'Available service categories:',
    categoryList,
    '',
    'User said:',
    `"${escapedQuery}"`,
    '',
    'Task:',
    '1. Analyze what the user ACTUALLY NEEDS (their intent/problem, not their exact words)',
    '2. Determine which category or categories can BEST SOLVE their problem',
    '3. Provide CONFIDENCE SCORES (0-100) for each category',
    '4. If no category truly fits (< 50% confidence), return null for topMatch',
    '',
    'Output ONLY valid JSON (no markdown, no code blocks):',
    '{',
    '  "intent": "User\'s actual problem/need in one sentence",',
    '  "reasoning": "Why this is the best match based on problem-solving fit",',
    '  "topMatch": {',
    '    "category": "Best category name from list (or null if low confidence)",',
    '    "confidence": 85',
    '  },',
    '  "closeMatches": [',
    '    { "category": "Category name", "confidence": 60 },',
    '    { "category": "Another category", "confidence": 45 }',
    '  ]',
    '}',
  ].join("\n"));

  console.log("[semantic-search] user_input:", cleanQuery);
  console.log("[semantic-search] categories_count:", categories.length);
  console.log("[semantic-search] prompt_length:", prompt.length);

  try {
    const res = await fetch(DEEPSEEK_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3, // Lower temperature for consistent reasoning
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[semantic-search-error] API error:", res.status, errText?.slice(0, 200));
      return {
        intent: userQuery,
        topMatch: null,
        closeMatches: [],
        reasoning: `API error: ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawText = data?.choices?.[0]?.message?.content?.trim();

    if (!rawText) {
      console.log("[semantic-search] Empty response from DeepSeek");
      return {
        intent: userQuery,
        topMatch: null,
        closeMatches: [],
        reasoning: "No response from AI",
      };
    }

    console.log("[semantic-search] raw_response:", rawText.slice(0, 300));

    const parsed = JSON.parse(rawText) as {
      intent?: string;
      reasoning?: string;
      topMatch?: { category?: string | null; confidence?: number } | null;
      closeMatches?: Array<{ category?: string; confidence?: number }>;
    };

    // Validate category names against available categories
    const validCategoryNames = new Set(categories.map((c) => c.name.toLowerCase()));

    const topMatch = parsed.topMatch?.category && parsed.topMatch.confidence
      ? {
          category: parsed.topMatch.category,
          confidence: Math.min(100, Math.max(0, parsed.topMatch.confidence)),
        }
      : null;

    const closeMatches = Array.isArray(parsed.closeMatches)
      ? parsed.closeMatches
          .filter(
            (m) =>
              m.category &&
              validCategoryNames.has(m.category.toLowerCase()) &&
              m.confidence &&
              m.confidence < (topMatch?.confidence ?? 100)
          )
          .slice(0, 3)
          .map((m) => ({
            category: m.category!,
            confidence: Math.min(100, Math.max(0, m.confidence!)),
          }))
      : [];

    const result: DeepseekSemanticResult = {
      intent: parsed.intent || userQuery,
      topMatch,
      closeMatches,
      reasoning: parsed.reasoning || "Unable to determine reasoning",
    };

    console.log("[semantic-search] result:", JSON.stringify(result).slice(0, 300));
    return result;
  } catch (e) {
    console.error("[semantic-search-error] Parse or fetch error:", e);
    return {
      intent: userQuery,
      topMatch: null,
      closeMatches: [],
      reasoning: `Error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}