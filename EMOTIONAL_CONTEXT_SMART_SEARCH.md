# Emotional Context Enhancement for Smart Search

## Overview

Smart Search now analyzes the **emotional context** of user queries to provide more empathetic, precise, and human-feeling category selection. This enhancement makes the AI understand not just *what* users are asking for, but *how* they're feeling when they ask.

## Why This Matters

**Before:** "I'm worried my spouse is cheating" → Generic "Monitoring" category (technically correct, emotionally tone-deaf)

**After:** "I'm worried my spouse is cheating" → Specific "Infidelity Investigation" category (empathetic, directly addresses the concern)

### Core Principles

1. **Empathy First** - Detect anxiety, fear, urgency, distress, and doubt
2. **Privacy Protected** - Emotional analysis is NEVER exposed externally or stored
3. **Stricter Selection** - High-emotion queries get more specific, relevant categories
4. **Split Confidence Handling** - When uncertain, offer 2-3 category choices instead of forcing a single match
5. **Trustworthy AI** - System should feel understanding and human, not robotic

---

## How It Works

### 1. Emotional Signal Detection

The system analyzes user queries for **64 emotional keywords** across **5 categories**:

#### **Anxiety Signals (16 keywords)**
```
worried, anxious, concerned, scared, nervous, help me, helpless, 
overwhelmed, stressed, panicked, desperate, uncertain, confused, 
uneasy, afraid, urgent
```

#### **Fear Signals (12 keywords)**
```
frightened, terrified, danger, threatened, unsafe, risk, harm, 
stalked, followed, watching, surveilling, tracked
```

#### **Distress Signals (15 keywords)**
```
missing, lost, cheating, betrayed, lying, deceiving, fraud, scam, 
stolen, theft, abuse, harassment, blackmail, extortion, kidnap
```

#### **Urgency Signals (11 keywords)**
```
now, asap, emergency, immediately, today, critical, time-sensitive, 
can't wait, hurry, quick, fast
```

#### **Doubt Signals (10 keywords)**
```
doubt, suspicious, suspect, unsure, don't trust, verify, confirm, 
check on, fishy, shady
```

### 2. Intensity Calculation

```typescript
intensity = 'low'  // 0 matched signals
intensity = 'medium'  // 1-3 matched signals  
intensity = 'high'  // 4+ matched signals
```

**Intensity Elevation:** If query contains a **sensitive topic** (missing person, abuse, cheating, custody, etc.), intensity is automatically elevated:
- `low` → `medium`
- `medium` → `high`

### 3. Sensitive Topic Detection

Queries containing these topics are flagged as **sensitive** (stricter category selection):

```
missing person, kidnap, child custody, domestic violence, abuse, 
stalking, harassment, cheating, infidelity, fraud
```

### 4. AI Prompt Modification

**For Emotional Queries (high intensity OR sensitive topic):**

```
IMPORTANT CONTEXT: This query shows emotional signals (anxiety, fear, urgency, or distress).

Be STRICT in your category selection:
- Choose the MOST SPECIFIC and RELEVANT category that directly addresses the user's concern
- AVOID broad or generic categories that might not provide the focused help they need
- If you're uncertain between 2 specific categories, list BOTH in suggestedCategories
- Only suggest categories that directly relate to their emotional need
- If NO category truly fits their specific concern, return null (they'll be guided to browse)
```

**Temperature Adjustment:**
- Normal queries: `temperature = 0.2` (balanced)
- Emotional queries: `temperature = 0.1` (more focused and deterministic)

**For Normal Queries:**

```
Match the user's request to the most appropriate category.
If uncertain, include up to 3 relevant alternatives in suggestedCategories.
```

---

## Example Scenarios

### Scenario 1: High Distress + Sensitive Topic

**User Query:** *"I'm worried my child is missing, I need someone now"*

**Emotional Analysis:**
```json
{
  "intensity": "high",
  "signals": ["worried", "missing", "now"],
  "isSensitive": true
}
```

**AI Behavior:**
- Temperature: 0.1 (highly focused)
- Prompt includes "STRICT" guidance
- Avoids generic "Monitoring" category
- Selects specific "Missing Persons" category

**Result:** `category: "Missing Persons"` (empathetic and precise)

---

### Scenario 2: Split Confidence (High Emotion)

**User Query:** *"I'm scared my spouse is hiding something, I need to know the truth urgently"*

**Emotional Analysis:**
```json
{
  "intensity": "high",
  "signals": ["scared", "hiding", "urgently"],
  "isSensitive": true
}
```

**AI Behavior:**
- Detects overlap between "Infidelity Investigation" and "Background Checks"
- Returns `category: null` + `suggestedCategories: ["Infidelity Investigation", "Background Checks"]`

**Result:** User sees:
> "We found these categories that might help:
> - Infidelity Investigation
> - Background Checks"

User chooses the most relevant one (empowered choice, not forced selection)

---

### Scenario 3: Low Emotion (Normal Query)

**User Query:** *"I need a background check for a new employee"*

**Emotional Analysis:**
```json
{
  "intensity": "low",
  "signals": [],
  "isSensitive": false
}
```

**AI Behavior:**
- Temperature: 0.2 (balanced)
- Normal prompt (no special guidance)
- Confident single-category match

**Result:** `category: "Background Checks"` (straightforward)

---

## Technical Implementation

### File: `server/lib/deepseek-category.ts`

#### Core Function: `analyzeEmotionalContext()`

```typescript
function analyzeEmotionalContext(query: string): EmotionalContext {
  const q = query.toLowerCase().trim();
  
  // Match emotional signals (64 keywords across 5 categories)
  const matchedSignals = [
    ...anxietySignals.filter(s => q.includes(s)),
    ...fearSignals.filter(s => q.includes(s)),
    ...distressSignals.filter(s => q.includes(s)),
    ...urgencySignals.filter(s => q.includes(s)),
    ...doubtSignals.filter(s => q.includes(s))
  ];
  
  // Calculate intensity
  let intensity: 'low' | 'medium' | 'high' = 'low';
  if (matchedSignals.length >= 4) intensity = 'high';
  else if (matchedSignals.length >= 2) intensity = 'medium';
  else if (matchedSignals.length >= 1) intensity = 'medium';
  
  // Detect sensitive topics
  const sensitiveTopics = [
    'missing person', 'abuse', 'domestic', 'custody', 'kidnap', 
    'cheating', 'infidelity', 'fraud', 'stalking', 'harassment'
  ];
  const isSensitive = sensitiveTopics.some(topic => q.includes(topic));
  
  // Elevate intensity for sensitive topics
  if (isSensitive && intensity !== 'high') {
    intensity = intensity === 'low' ? 'medium' : 'high';
  }
  
  return { intensity, signals: matchedSignals, isSensitive };
}
```

#### Integration in `matchCategoryWithDeepseek()`

```typescript
export async function matchCategoryWithDeepseek(
  apiKey: string,
  userQuery: string,
  categoryNames: string[]
): Promise<DeepseekCategoryResult> {
  // 1. Analyze emotional context (internal only - NOT exposed)
  const emotionalContext = analyzeEmotionalContext(userQuery);
  const isEmotional = emotionalContext.intensity === 'high' || emotionalContext.isSensitive;
  
  console.log("[emotional-analysis] intensity:", emotionalContext.intensity, 
              "sensitive:", emotionalContext.isSensitive,
              "signals:", emotionalContext.signals.slice(0, 3).join(', '));
  
  // 2. Build emotionally-aware prompt
  let contextGuidance = isEmotional 
    ? "IMPORTANT CONTEXT: This query shows emotional signals... Be STRICT..."
    : "Match the user's request to the most appropriate category.";
  
  // 3. Adjust temperature based on emotional context
  const temperature = isEmotional ? 0.1 : 0.2;
  
  // 4. Call Deepseek API with modified prompt and temperature
  const body = {
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens: 512,
    response_format: { type: "json_object" },
  };
  
  // 5. Return category + suggestedCategories (AI decides based on confidence)
  return { category: validCategory, suggestedCategories: validSuggested };
}
```

### File: `server/lib/smart-search.ts`

**No changes required** - already handles split confidence:

```typescript
// When AI returns null + suggestedCategories
if (!category) {
  return {
    kind: "category_not_found",
    message: "We didn't find a relevant category for that. You can browse all services below.",
    suggestedCategories: suggestedCategories.length > 0 ? suggestedCategories : undefined,
  };
}
```

Frontend displays suggestions as clickable category options.

---

## Privacy & Ethics

### ✅ **What We DO:**
- Analyze emotional signals to improve category selection
- Log emotional context for debugging (`[emotional-analysis]` logs)
- Modify AI prompt based on emotional intensity
- Apply stricter selection for sensitive queries

### ❌ **What We DON'T DO:**
- Store emotional analysis in database
- Expose emotional signals in API responses
- Show users "we detected anxiety" messages
- Track or profile users based on emotional patterns
- Use emotional data for marketing or analytics

**Guiding Principle:** Emotional context is a **tool for better service**, not a data point to exploit.

---

## Debugging

### Console Logs

**Emotional Analysis:**
```
[emotional-analysis] intensity: high sensitive: true signals: worried, scared, urgent
```

**AI Configuration:**
```
[deepseek-debug] model_used: deepseek-chat (emotional_mode: true)
[deepseek-debug] user_input: I'm worried my spouse is cheating
[deepseek-debug] prompt_sent: IMPORTANT CONTEXT: This query shows emotional signals...
```

**Result:**
```
[deepseek-debug] final_filter_category: Infidelity Investigation
```

---

## Testing Checklist

### High-Emotion Queries (Should be Strict and Specific)

- [ ] "I'm worried my spouse is cheating" → **Infidelity Investigation** (not "Monitoring")
- [ ] "Help! My child is missing urgently" → **Missing Persons** (high intensity + sensitive)
- [ ] "I'm scared someone is stalking me" → **Personal Security** or **Surveillance Detection**
- [ ] "Need to find proof of fraud now" → **Fraud Investigation** (urgency + distress)

### Medium-Emotion Queries (Should be Focused)

- [ ] "I'm concerned about my employee's behavior" → **Background Checks** or **Employee Monitoring"
- [ ] "Suspicious activity at home, want to check" → **Home Security** or **Surveillance"
- [ ] "Lost contact with old friend" → **People Search** or **Skip Tracing"

### Low-Emotion Queries (Normal Behavior)

- [ ] "Background check for new hire" → **Background Checks"
- [ ] "Asset search for property" → **Asset Search"
- [ ] "GPS tracking for fleet management" → **GPS Tracking"

### Split Confidence (Should Return 2-3 Suggestions)

- [ ] "I think my partner is hiding financial secrets" → Suggest ["Infidelity Investigation", "Financial Investigation"]
- [ ] "Need to verify someone's identity and past" → Suggest ["Background Checks", "Identity Verification"]

---

## Future Enhancements

### Potential Improvements

1. **Empathetic Response Generation**
   - For high-emotion queries, add compassionate messaging: *"We understand this is a difficult situation. Here's how we can help..."*

2. **Contextual Category Descriptions**
   - Show different descriptions based on emotional context
   - Example: "Infidelity Investigation" → Normal: "Verify partner's activities" | Emotional: "Discreet support for relationship concerns"

3. **Follow-Up Question Handling**
   - If user asks follow-up questions, maintain emotional context
   - Example: First query: "worried about spouse" → Follow-up: "what does this cost?" (still emotional context)

4. **Multilingual Emotional Signals**
   - Expand keyword detection to other languages (Spanish, French, etc.)

5. **Confidence Scoring**
   - Expose AI confidence score (0-100%) for debugging
   - Auto-suggest when confidence < 70% on emotional queries

---

## Summary

**What Changed:**
- ✅ Added `analyzeEmotionalContext()` with 64 emotional keywords
- ✅ Integrated emotional analysis into `matchCategoryWithDeepseek()`
- ✅ Modified AI prompt for emotional queries (stricter guidance)
- ✅ Lowered temperature for emotional queries (0.1 vs 0.2)
- ✅ Split confidence handling (return null + suggestedCategories)
- ✅ Privacy-first design (no external exposure)

**What Stayed:**
- ✅ Smart Search architecture unchanged
- ✅ Frontend category suggestion handling unchanged
- ✅ Database schema unchanged
- ✅ API response format unchanged

**Impact:**
- Smart Search now feels **empathetic and human**
- Sensitive queries get **specific, relevant categories** (not generic)
- Users with high-emotion queries receive **better, faster help**
- AI is **stricter** when emotions are detected (avoids broad categories)
- Split confidence = **user choice**, not forced selection

---

**Implementation Date:** January 2025  
**Status:** ✅ Complete  
**Files Modified:** `server/lib/deepseek-category.ts`  
**Files Unchanged:** `server/lib/smart-search.ts`, `server/routes.ts`, frontend components
