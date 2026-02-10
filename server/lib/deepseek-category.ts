/**
 * Deepseek-based category matching: understand user text and map to existing service categories.
 * Includes emotional context detection for empathetic, trustworthy responses.
 * Uses DEEPSEEK_API_KEY from config. Falls back to null on missing key or API errors.
 */

const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export interface DeepseekCategoryResult {
  category: string | null;
  suggestedCategories: string[];
}

/**
 * Emotional context analyzer - detects anxiety, fear, urgency, doubt, distress.
 * Used internally to guide category selection - NOT exposed externally.
 */
interface EmotionalContext {
  intensity: 'low' | 'medium' | 'high';
  signals: string[];
  isSensitive: boolean;
}

/**
 * Analyze emotional signals in user query to guide category selection.
 * Returns emotional intensity and whether query is sensitive.
 * This analysis is ONLY used for decision-making, never stored or exposed.
 */
function analyzeEmotionalContext(query: string): EmotionalContext {
  const q = query.toLowerCase().trim();
  
  // Emotional signal patterns
  const anxietySignals = [
    'worried', 'anxious', 'concerned', 'scared', 'afraid', 'nervous',
    'unsure', 'confused', 'don\'t know', 'not sure', 'help me',
    'desperate', 'urgent', 'asap', 'immediately', 'emergency'
  ];
  
  const fearSignals = [
    'frightened', 'terrified', 'scared', 'afraid', 'fear', 'threatened',
    'danger', 'dangerous', 'unsafe', 'risk', 'risky', 'harm'
  ];
  
  const distressSignals = [
    'missing', 'lost', 'disappeared', 'vanished', 'gone', 'can\'t find',
    'cheating', 'affair', 'betrayed', 'lied', 'lying', 'trust',
    'stealing', 'stolen', 'fraud', 'scam', 'scammed'
  ];
  
  const urgencySignals = [
    'now', 'asap', 'immediately', 'urgent', 'emergency', 'quick', 'quickly',
    'soon', 'right away', 'today', 'tonight', 'this week'
  ];
  
  const doubtSignals = [
    'doubt', 'suspicious', 'suspect', 'unsure', 'uncertain', 'question',
    'wondering', 'not sure', 'don\'t trust', 'something wrong'
  ];
  
  const allSignals = [
    ...anxietySignals,
    ...fearSignals,
    ...distressSignals,
    ...urgencySignals,
    ...doubtSignals
  ];
  
  // Detect matched signals
  const matchedSignals: string[] = [];
  for (const signal of allSignals) {
    if (q.includes(signal)) {
      matchedSignals.push(signal);
    }
  }
  
  // Calculate intensity
  let intensity: 'low' | 'medium' | 'high' = 'low';
  if (matchedSignals.length >= 4) {
    intensity = 'high';
  } else if (matchedSignals.length >= 2) {
    intensity = 'medium';
  } else if (matchedSignals.length >= 1) {
    intensity = 'medium';
  }
  
  // Sensitive topics that warrant stricter handling
  const sensitiveTopics = [
    'missing person', 'missing child', 'missing kid', 'disappeared',
    'abuse', 'domestic', 'violence', 'stalking', 'harassment',
    'cheating', 'affair', 'infidelity', 'betrayal',
    'fraud', 'scam', 'steal', 'theft',
    'custody', 'child custody', 'kidnap'
  ];
  
  const isSensitive = sensitiveTopics.some(topic => q.includes(topic));
  
  // Elevate intensity for sensitive topics
  if (isSensitive && intensity === 'low') {
    intensity = 'medium';
  }
  if (isSensitive && intensity === 'medium') {
    intensity = 'high';
  }
  
  return {
    intensity,
    signals: matchedSignals,
    isSensitive
  };
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
 * Uses emotional context to guide category selection - stricter for sensitive/emotional queries.
 * Returns category (exact match from list) or null, plus up to 3 suggested categories from the list.
 * Emotional analysis is used ONLY internally, never exposed externally.
 */
export async function matchCategoryWithDeepseek(
  apiKey: string,
  userQuery: string,
  categoryNames: string[]
): Promise<DeepseekCategoryResult> {
  if (!apiKey.trim() || categoryNames.length === 0) {
    return { category: null, suggestedCategories: [] };
  }

  // Analyze emotional context (internal only - NOT exposed)
  const emotionalContext = analyzeEmotionalContext(userQuery);
  const isEmotional = emotionalContext.intensity === 'high' || emotionalContext.isSensitive;
  
  console.log("[emotional-analysis] intensity:", emotionalContext.intensity, 
              "sensitive:", emotionalContext.isSensitive,
              "signals:", emotionalContext.signals.slice(0, 3).join(', '));

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
  
  // Build emotionally-aware prompt
  let contextGuidance = '';
  if (isEmotional) {
    contextGuidance = [
      "",
      "IMPORTANT CONTEXT: This query shows emotional signals (anxiety, fear, urgency, or distress).",
      "Be STRICT in your category selection:",
      "- Choose the MOST SPECIFIC and RELEVANT category that directly addresses the user's concern",
      "- AVOID broad or generic categories that might not provide the focused help they need",
      "- If you're uncertain between 2 specific categories, list BOTH in suggestedCategories",
      "- Only suggest categories that directly relate to their emotional need",
      "- If NO category truly fits their specific concern, return null (they'll be guided to browse)",
      ""
    ].join("\n");
  } else {
    contextGuidance = [
      "",
      "Match the user's request to the most appropriate category.",
      "If uncertain, include up to 3 relevant alternatives in suggestedCategories.",
      ""
    ].join("\n");
  }
  
  const prompt = sanitizeForAI([
    "Our service categories (use only these exact names): [" + list + "].",
    "",
    'User said: "' + escapedQuery + '"',
    contextGuidance,
    "Reply with JSON only:",
    '{"category": "<exact category name from the list above, or null if none fit>", "suggestedCategories": ["up to 3 category names from the list if relevant"]}',
  ].join("\n"));

  const url = DEEPSEEK_BASE;
  const body = {
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: isEmotional ? 0.1 : 0.2,  // Lower temperature for emotional queries (more focused)
    max_tokens: 512,
    response_format: { type: "json_object" },
  };

  console.log("[deepseek-debug] model_used:", MODEL, "(emotional_mode:", isEmotional, ")");
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