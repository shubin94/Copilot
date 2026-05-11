/**
 * Country-Level Location Intelligence Content Configuration
 * PHASE 1: Country pages only (India, US, UK)
 * 
 * This is config-driven content that supports future scaling to state/city levels.
 * No database, no CMS, no admin UI in this phase.
 */

export interface CountryContent {
  intro: string;
  commonServices: string;
  hiringGuidance: string;
  confidentiality: string;
  faq: Array<{
    question: string;
    answer: string;
  }>;
}

export const COUNTRY_CONTENT: Record<string, CountryContent> = {
  india: {
    intro:
      "India has a mature private investigation market, but the quality of service can vary from one firm to another. Use this page to compare investigators who clearly explain their experience, their approach, and the types of cases they actually handle.",
    commonServices:
      "In India, common requests include background checks, matrimonial investigations, surveillance, corporate due diligence, employee misconduct checks, and missing-person searches. Many investigators focus on a few core services rather than trying to cover everything.",
    hiringGuidance:
      "Before you hire, ask what similar cases they have handled, how they keep you updated, and what the quoted fee includes. A clear scope and communication plan matter more than broad promises.",
    confidentiality:
      "Ask how case notes are stored, who can access them, and when information is shared or archived. A good investigator should explain that process in plain language before work begins.",
    faq: [
      {
        question: "What do detectives in India usually help with?",
        answer:
          "Most clients use detectives in India for background checks, matrimonial cases, surveillance, fraud-related checks, or missing-person searches. The right investigator depends on the type of case and the level of discretion you need.",
      },
      {
        question: "How do detective fees usually work in India?",
        answer:
          "Many investigators use daily rates or fixed project fees. The best quote is the one that clearly lists what is included, what may cost extra, and how updates will be shared.",
      },
      {
        question: "How can I compare two detectives before hiring?",
        answer:
          "Compare how they explain past case experience, how quickly they respond, and how clearly they describe the next steps. Straight answers are usually a better sign than polished sales language.",
      },
      {
        question: "What should I ask before sharing my case details?",
        answer:
          "Ask who will see the information, how it is stored, and how progress updates are handled. You should feel comfortable with the process before you share sensitive details.",
      },
      {
        question: "How do I know if a detective has relevant experience?",
        answer:
          "Look for direct experience with cases like yours, not just general claims. A credible investigator can explain the kind of work they have done, what results they can realistically deliver, and where their limits are.",
      },
    ],
  },

  usa: {
    intro:
      "The US private investigation market varies by state, so the strongest choice is usually an investigator who is licensed where you need the work done and who is clear about their process from the start.",
    commonServices:
      "Common requests in the US include background checks, surveillance, workers' compensation cases, infidelity investigations, asset searches, skip tracing, and litigation support. Many investigators focus on a few core specialties.",
    hiringGuidance:
      "Before hiring, confirm the state license, ask how billing works, and get the scope in writing. It is also worth checking how they handle communication, evidence, and deadlines.",
    confidentiality:
      "A good investigator should be able to explain how they handle case notes, evidence, and client communication. Clear confidentiality practices matter more than broad claims.",
    faq: [
      {
        question: "Do detective rules vary by state in the US?",
        answer:
          "Yes. State rules can differ, so it is smart to confirm licensing requirements for the state where the work will happen.",
      },
      {
        question: "How are private detective fees usually structured?",
        answer:
          "Many investigators use hourly billing, retainers, or fixed project fees depending on the case. Ask for a written estimate that explains what is included.",
      },
      {
        question: "What kinds of cases do private investigators handle?",
        answer:
          "Background checks, surveillance, asset searches, workplace issues, and litigation support are all common. The best fit depends on the specific case and the investigator's experience.",
      },
      {
        question: "What should I check before hiring a detective in the US?",
        answer:
          "Check the license, ask for proof of insurance if relevant, and look for a clear description of how they work. You want someone who can explain the process without overpromising.",
      },
      {
        question: "How can I judge whether an investigator is experienced?",
        answer:
          "Ask about similar cases, typical timelines, and how they communicate progress. Real experience usually shows up in the way they answer practical questions.",
      },
    ],
  },

  "united-kingdom": {
    intro:
      "The UK has a professional private investigation market, and the best results usually come from investigators who can explain their experience, their limitations, and how they handle sensitive information.",
    commonServices:
      "In the UK, common work includes background checks, surveillance, matrimonial matters, corporate investigations, legal support, asset tracing, and employee vetting. Many investigators build their practice around a few specialties.",
    hiringGuidance:
      "Before you hire, confirm licensing or membership details, ask how the work will be handled, and request a written scope of engagement. A clear quote and clear communication are both important.",
    confidentiality:
      "Ask how personal data is stored, who can access it, and what happens to the records after the case ends. Good investigators should answer that clearly and without fuss.",
    faq: [
      {
        question: "What kinds of cases do UK detectives usually handle?",
        answer:
          "Common cases include background checks, surveillance, matrimonial matters, asset tracing, and workplace investigations. The right investigator depends on the detail and sensitivity of the case.",
      },
      {
        question: "How do UK investigator fees usually work?",
        answer:
          "Many investigators use day rates or fixed fees. Ask for a quote that shows what is included and what may be billed separately.",
      },
      {
        question: "What should I confirm before hiring in the UK?",
        answer:
          "Check their credentials, ask about similar cases, and make sure their communication style fits your needs. Experience and clarity matter more than polished marketing.",
      },
      {
        question: "How can I tell if an investigator is a good fit?",
        answer:
          "A good fit is someone who can explain how they work, what they need from you, and what they can realistically deliver. Clear answers are usually the best signal.",
      },
      {
        question: "Can a UK detective help with family matters?",
        answer:
          "Yes. Many investigators handle family-related cases, including relationship concerns and matrimonial matters, while keeping the process discreet and practical.",
      },
    ],
  },
};

/**
 * Get content for a specific country
 * Returns undefined if country not configured for this phase
 * 
 * Handles slug aliases: "united-states" → "usa", etc.
 */
const COUNTRY_SLUG_ALIASES: Record<string, string> = {
  "united-states": "usa",
  "us": "usa",
  "uk": "united-kingdom",
  "gb": "united-kingdom",
  "great-britain": "united-kingdom",
  "in": "india",
};

export function getCountryContent(
  countrySlug: string
): CountryContent | undefined {
  const normalized = COUNTRY_SLUG_ALIASES[countrySlug] ?? countrySlug;
  return COUNTRY_CONTENT[normalized];
}

/**
 * Check if a country is enabled for LocationIntelligenceBlock in this phase
 * PHASE 1: Only India, USA, UK — accepts both canonical keys and slug aliases
 */
export const COUNTRY_INTELLIGENCE_ENABLED = new Set([
  "india",
  "usa",
  "united-kingdom",
  // Slug aliases — URL slugs that resolve to the above
  "united-states",
  "us",
  "uk",
  "gb",
  "great-britain",
  "in",
]);

export function isCountryEnabled(countrySlug: string): boolean {
  return COUNTRY_INTELLIGENCE_ENABLED.has(countrySlug);
}
