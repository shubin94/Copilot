/**
 * Quick check: call Gemini API with a simple prompt and log result or error.
 * Run: npx tsx scripts/check-gemini-api.ts
 */
import "dotenv/config";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-2.5-flash";

async function checkGemini() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not set in .env");
    process.exit(1);
  }

  const url = `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: "Reply with one word: OK" }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 64,
    },
  };

  console.log("Calling Gemini API:", MODEL, "...");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string; code?: number } };

    if (!res.ok) {
      const err = data?.error;
      console.error("❌ Gemini API error:", res.status, err?.message || JSON.stringify(data).slice(0, 200));
      process.exit(1);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) {
      console.log("✅ Gemini API is working. Reply:", text);
    } else {
      console.log("✅ Gemini API responded but no text in reply:", JSON.stringify(data).slice(0, 300));
    }
  } catch (e: any) {
    console.error("❌ Request failed:", e?.message || e);
    process.exit(1);
  }
}

checkGemini();
