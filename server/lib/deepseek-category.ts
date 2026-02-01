/**
 * Deepseek-based category matching: understand user text and map to existing service categories.
 * Uses DEEPSEEK_API_KEY from config. Falls back to null on missing key or API errors.
 */

const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export interface DeepseekCategoryResult {
  category: string | null;
  suggestedCategories: string[];
}

/**
 * Sanitize inputs to prevent Unicode ByteString crashes in AI providers.
 */
function sanitizeForAI(input: string): string {
  // Normalize to NFC form
  let sanitized = input.normalize('NFC');
  
  // Remove invisible Unicode control characters
  // Keep only newlines (\n) and tabs (\t) from control chars
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');
  
  return sanitized;
}

/**
 * Call Deepseek to match user query to one of the allowed category names.
 * Returns category (exact match from list) or null, plus up to 3 suggested categories from the list.
 */
export async function matchCategoryWithDeepseek(
  apiKey: string,
  userQuery: string,
  categoryNames: string[]
): Promise<DeepseekCategoryResult> {
  if (!apiKey.trim() || categoryNames.length === 0) {
    return { category: null, suggestedCategories: [] };
  }

  // Sanitize inputs to prevent Unicode ByteString crashes in AI providers.
  const cleanQuery = sanitizeForAI(userQuery);
  const cleanCategories = categoryNames.map(n => sanitizeForAI(n));
  
  // Create mapping from sanitized names back to original names
  const cleanToOriginal = new Map<string, string>();
  categoryNames.forEach((orig, idx) => {
    cleanToOriginal.set(cleanCategories[idx], orig);
  });

  const list = cleanCategories.map((n) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(", ");
  const escapedQuery = cleanQuery.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const prompt = sanitizeForAI([
    "Our service categories (use only these exact names): [" + list + "].",
    "",
    'User said: "' + escapedQuery + '"',
    "",
    "Figure out which category fits. Reply with JSON only:",
    '{"category": "<exact category name from the list above, or null if none fit>", "suggestedCategories": ["up to 3 category names from the list if relevant"]}',
  ].join("\n"));

  const url = DEEPSEEK_BASE;
  const body = {
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 512,
    response_format: { type: "json_object" },
  };

  console.log("[deepseek-debug] model_used:", MODEL);
  console.log("[deepseek-debug] user_input:", cleanQuery);
  console.log("[deepseek-debug] categories_sent:", JSON.stringify(cleanCategories));
  console.log("[deepseek-debug] prompt_sent:", prompt);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[deepseek-error] Deepseek API error:", res.status, errText?.slice(0, 200));
      return { category: null, suggestedCategories: [] };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawText = data?.choices?.[0]?.message?.content?.trim();
    if (!rawText) {
      console.log("[deepseek-debug] deepseek_raw_response: (empty)");
      return { category: null, suggestedCategories: [] };
    }

    console.log("[deepseek-debug] deepseek_raw_response:", rawText);

    const parsed = JSON.parse(rawText) as { category?: string | null; suggestedCategories?: string[] };
    const category = parsed?.category != null && parsed.category !== "null"
      ? String(parsed.category).trim()
      : null;
    const suggested = Array.isArray(parsed?.suggestedCategories)
      ? parsed.suggestedCategories.map((s) => String(s).trim()).filter((s) => cleanCategories.includes(s))
      : [];

    console.log("[deepseek-debug] parsed_category:", category);

    // Map sanitized names back to original names
    const validCategory = category && cleanCategories.includes(category) 
      ? (cleanToOriginal.get(category) || null)
      : null;
    const validSuggested = suggested
      .map(s => cleanToOriginal.get(s))
      .filter((s): s is string => s !== undefined)
      .slice(0, 3);

    console.log("[deepseek-debug] final_filter_category:", validCategory);

    return { category: validCategory, suggestedCategories: validSuggested };
  } catch (e) {
    console.error("[deepseek-error] Deepseek category match error:", e);    return { category: null, suggestedCategories: [] };
  }
}