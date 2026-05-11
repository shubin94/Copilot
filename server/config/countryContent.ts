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
      "In India, common requests include Background Checks, Surveillance, Asset Searches, Matrimonial Investigations, and Fraud Investigations. Many investigators focus on a few core services rather than trying to cover everything.",
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
      "Common requests in the US include Background Checks, Surveillance, Asset Searches, Matrimonial Investigations, and Fraud Investigations, alongside litigation support where needed. Many investigators focus on a few core specialties.",
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
      "In the UK, common work includes Background Checks, Surveillance, Asset Searches, Matrimonial Investigations, and Fraud Investigations, with legal support where required. Many investigators build their practice around a few specialties.",
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

// ==============================================================
// STATE-LEVEL CONTENT — PHASE 2
// Karnataka (India), California (USA), Greater London (UK)
// Same shape as CountryContent — reuses the same interface.
// ==============================================================

export const STATE_CONTENT: Record<string, Record<string, CountryContent>> = {
  india: {
    karnataka: {
      intro:
        "Karnataka has one of India's most active private investigation markets, driven by Bengaluru's large corporate and technology sector. Most agencies handle both personal and corporate cases, with strong demand for background verification and due diligence work. Service quality varies — use this page to compare investigators who can clearly explain their experience and process.",
      commonServices:
        "Common requests in Karnataka include Background Checks, Surveillance, Matrimonial Investigations, Fraud Investigations, and Corporate Due Diligence. Bengaluru-based agencies typically cover the whole state, with field staff or partners in Mysuru, Mangaluru, and Hubballi.",
      hiringGuidance:
        "Before hiring, clarify whether the investigator covers your specific area and how they handle travel for cases outside Bengaluru. Ask for a written scope of work before any fieldwork begins. Investigators who give specific, direct answers about similar cases are generally a better choice than those who rely on broad claims.",
      confidentiality:
        "Karnataka investigators should explain how digital evidence, photographs, and case reports are stored and who has access. Ask what happens to your data after the case closes. A professional will answer these questions clearly before any payment is discussed.",
      faq: [
        {
          question: "What types of cases do detectives in Karnataka usually handle?",
          answer:
            "Most clients in Karnataka use investigators for background checks, matrimonial matters, corporate due diligence, surveillance assignments, and fraud-related inquiries. Bengaluru agencies often handle IT-sector employee screening and vendor verification as well.",
        },
        {
          question: "Do Karnataka investigators cover areas outside Bengaluru?",
          answer:
            "Many Bengaluru-based agencies operate statewide, with field staff or partners in Mysuru, Mangaluru, Hubballi, and other cities. Confirm geographic coverage before engaging — especially for cases requiring on-the-ground presence outside the capital.",
        },
        {
          question: "How are fees typically structured for detective work in Karnataka?",
          answer:
            "Most investigators use daily rates, fixed project fees, or a combination. Ask for a written breakdown that covers travel, reporting, and any additional expenses before the work begins. Clarity on billing matters more than a low headline rate.",
        },
        {
          question: "What should I ask before sharing case details with a Karnataka detective?",
          answer:
            "Confirm how they store client information, who within the agency will have access to your case, and how results and evidence are delivered. A credible investigator will answer these questions before any payment is discussed.",
        },
        {
          question: "How do I know if a Karnataka detective has the right experience for my case?",
          answer:
            "Ask directly about similar cases and what outcomes they can realistically deliver. Relevant experience shows up in how specifically they describe past work — not in broad professional claims.",
        },
      ],
    },
  },
  usa: {
    california: {
      intro:
        "California has one of the most tightly regulated private investigation markets in the US. All licensed investigators must hold a California Bureau of Security and Investigative Services (BSIS) licence. The market is large and concentrated in Los Angeles, San Francisco, and San Diego, with strong demand for corporate, legal support, and insurance-related work.",
      commonServices:
        "Common requests in California include Background Checks, Surveillance, Asset Searches, Corporate Due Diligence, and Fraud Investigations. Legal support — including witness location and evidence gathering for civil litigation — is also widely requested across the state's major metro areas.",
      hiringGuidance:
        "Before hiring, verify the investigator's BSIS licence number on the California Department of Consumer Affairs website. Ask how they handle California Privacy Rights Act (CPRA) compliance if your case involves personal data. A written engagement letter is standard practice in California, and any credible investigator will provide one before work begins.",
      confidentiality:
        "California has some of the strongest data privacy laws in the US. Ask any investigator how they handle personal information, how long they retain case files, and whether their data handling complies with CPRA requirements. Reputable investigators should answer this directly and without hesitation.",
      faq: [
        {
          question: "Do private detectives in California need to be licensed?",
          answer:
            "Yes. California requires all private investigators to hold a licence issued by the Bureau of Security and Investigative Services (BSIS). You can verify a licence at no cost through the California Department of Consumer Affairs website before engaging anyone.",
        },
        {
          question: "What kinds of cases do California investigators typically handle?",
          answer:
            "Background checks, surveillance, asset tracing, corporate due diligence, insurance fraud investigation, and litigation support are all common. The Los Angeles, San Francisco, and San Diego markets are particularly active for corporate and legal support work.",
        },
        {
          question: "How are private investigator fees structured in California?",
          answer:
            "Most California investigators bill hourly, with rates varying by case type, location, and the investigator's experience. For complex or multi-city assignments, a retainer arrangement is common. Always get a written estimate confirming what is included before work begins.",
        },
        {
          question: "What privacy rules apply to California investigations?",
          answer:
            "California has strict data privacy protections. Investigators cannot access certain records without authorisation and must handle personal data in compliance with CPRA. Confirm your investigator's data practices in writing before sharing any sensitive information.",
        },
        {
          question: "How do I evaluate whether a California PI is the right fit?",
          answer:
            "Verify the BSIS licence, check for any disciplinary history on the DCA website, and ask for examples of similar cases. A straightforward investigator will explain their process, limitations, and realistic outcomes without overpromising.",
        },
      ],
    },
  },
  "united-kingdom": {
    "greater-london": {
      intro:
        "London has a well-established private investigation market with a large number of agencies and independent investigators. The strongest firms tend to hold membership of professional bodies such as the Association of British Investigators (ABI) and are registered with the Information Commissioner's Office (ICO) for data protection compliance. Many investigators have backgrounds in law enforcement, military intelligence, or corporate security.",
      commonServices:
        "Common requests in London include Background Checks, Surveillance, Asset Searches, Matrimonial Investigations, and Corporate Due Diligence. Legal support work — including process serving, witness location, and evidence gathering for civil proceedings — is also widely available.",
      hiringGuidance:
        "Before hiring, ask whether the investigator is registered with the ICO and whether they hold professional indemnity insurance. A written contract is standard in London and any credible investigator will provide one before work begins. Membership of the ABI or a similar professional body is a useful indicator of professional standards.",
      confidentiality:
        "UK investigators are required to handle personal data in line with UK GDPR and the Data Protection Act 2018. Ask how case files, surveillance footage, and personal data will be stored, shared, and deleted after the case closes. ICO registration is a baseline requirement for any reputable London firm.",
      faq: [
        {
          question: "What kinds of cases do London private investigators usually handle?",
          answer:
            "Background checks, surveillance, matrimonial matters, asset tracing, and corporate due diligence are all common. Legal support work — including process serving and evidence gathering for civil litigation — is also widely requested across the London market.",
        },
        {
          question: "Do London investigators need to be licensed?",
          answer:
            "There is currently no mandatory licensing regime for private investigators in England and Wales. However, reputable London investigators typically hold membership of professional bodies such as the ABI, and are registered with the ICO for data protection compliance.",
        },
        {
          question: "How are investigator fees structured in London?",
          answer:
            "Most London investigators charge by the day or by the hour, with rates varying by case complexity and the seniority of the investigator assigned. For longer or multi-phase cases, a retainer arrangement is common. Always confirm the full billing scope in writing before work begins.",
        },
        {
          question: "What data protection rules apply to London investigations?",
          answer:
            "UK investigators must comply with UK GDPR and the Data Protection Act 2018. Ask how the investigator handles personal data, how long they retain case records, and how evidence will be delivered and stored at the end of the engagement.",
        },
        {
          question: "How do I assess whether a London investigator has relevant experience?",
          answer:
            "Ask directly about similar cases and what results they can realistically deliver. Membership of a professional body, ICO registration, and clear answers to practical questions about process and timeline are usually better indicators than broad claims of experience.",
        },
      ],
    },
  },
};

/**
 * State slug aliases — resolve alternative URL slugs to canonical state keys
 */
const STATE_SLUG_ALIASES: Record<string, Record<string, string>> = {
  "united-kingdom": {
    london: "greater-london",
    "city-of-london": "greater-london",
  },
  usa: {
    ca: "california",
  },
};

/**
 * Get content for a specific state
 * Returns undefined if state not configured for this phase
 */
export function getStateContent(
  countrySlug: string,
  stateSlug: string
): CountryContent | undefined {
  const normalizedCountry = COUNTRY_SLUG_ALIASES[countrySlug] ?? countrySlug;
  const normalizedState =
    (STATE_SLUG_ALIASES[normalizedCountry] ?? {})[stateSlug] ?? stateSlug;
  return STATE_CONTENT[normalizedCountry]?.[normalizedState];
}

/**
 * Check if a state is enabled for LocationIntelligenceBlock
 */
export function isStateEnabled(countrySlug: string, stateSlug: string): boolean {
  return !!getStateContent(countrySlug, stateSlug);
}
