/**
 * Gemini-based category matching: understand user text and map to existing service categories.
 * Uses GEMINI_API_KEY from config. Falls back to null on missing key or API errors.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-2.5-flash";

export interface GeminiCategoryResult {
  category: string | null;
  suggestedCategories: string[];
}

/**
 * Call Gemini to match user query to one of the allowed category names.
 * Returns category (exact match from list) or null, plus up to 3 suggested categories from the list.
 */
export async function matchCategoryWithGemini(
  apiKey: string,
  userQuery: string,
  categoryNames: string[]
): Promise<GeminiCategoryResult> {
  if (!apiKey.trim() || categoryNames.length === 0) {
    return { category: null, suggestedCategories: [] };
  }

  const list = categoryNames.map((n) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(", ");
  const escapedQuery = userQuery.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const prompt = [
    "Our service categories (use only these exact names): [" + list + "].",
    "",
    'User said: "' + escapedQuery + '"',
    "",
    "Figure out which category fits. Reply with JSON only:",
    '{"category": "<exact category name from the list above, or null if none fit>", "suggestedCategories": ["up to 3 category names from the list if relevant"]}',
  ].join("\n");

  const url = `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
    },
  };

  console.log("---------- [Gemini SEND] ----------");
  console.log("Categories we send:", categoryNames);
  console.log("User text we send:", userQuery);
  console.log("Full prompt we send to Gemini:\n", prompt);
  console.log("------------------------------------");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error:", res.status, errText?.slice(0, 200));
      return { category: null, suggestedCategories: [] };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) {
      console.log("---------- [Gemini REPLY] ----------");
      console.log("Raw reply: (empty)");
      console.log("-------------------------------------");
      return { category: null, suggestedCategories: [] };
    }

    console.log("---------- [Gemini REPLY] ----------");
    console.log("Raw reply from Gemini:\n", rawText);
    console.log("-------------------------------------");

    const parsed = JSON.parse(rawText) as { category?: string | null; suggestedCategories?: string[] };
    const category = parsed?.category != null && parsed.category !== "null"
      ? String(parsed.category).trim()
      : null;
    const suggested = Array.isArray(parsed?.suggestedCategories)
      ? parsed.suggestedCategories.map((s) => String(s).trim()).filter((s) => categoryNames.includes(s))
      : [];

    // Ensure category is from the list
    const validCategory = category && categoryNames.includes(category) ? category : null;
    const validSuggested = suggested.filter((s) => categoryNames.includes(s)).slice(0, 3);

    console.log("[Gemini] parsed result -> category:", validCategory, "| suggestedCategories:", validSuggested);

    return { category: validCategory, suggestedCategories: validSuggested };
  } catch (e) {
    console.error("Gemini category match error:", e);
    return { category: null, suggestedCategories: [] };
  }
}
