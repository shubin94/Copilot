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

export interface StateContent {
  stateOverview: string;
  commonCasesInState: string;
  coverageAndRegionalNotes: string;
  stateVsCityGuide: string;
  hiringAdvice: string;
  relatedServices: Array<{
    name: string;
    description: string;
  }>;
  topCitiesInState: Array<{
    name: string;
    description?: string;
  }>;
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
// Dedicated state-template structure with operational & regional focus
// ==============================================================

export const STATE_CONTENT: Record<string, Record<string, StateContent>> = {
  india: {
    karnataka: {
      stateOverview:
        "Karnataka's investigation market is concentrated in Bengaluru, where corporate demand from the IT sector drives service innovation. Outside the capital, investigators operate across tier-2 cities like Mysuru, Mangaluru, and Hubballi, typically managing cases through local networks or field associates. Service quality varies significantly based on an agency's scale, infrastructure, and case experience.",
      commonCasesInState:
        "In Karnataka, the most frequent assignments are Background Checks (especially for IT hiring), Corporate Due Diligence, Matrimonial Investigations, and Fraud Detection. Bengaluru dominates corporate work, while smaller cities see more personal investigations. Asset searches and surveillance are also common, particularly for finance-sector clients.",
      coverageAndRegionalNotes:
        "Most Bengaluru agencies operate statewide, though coverage outside the capital requires local contacts or field partners. Investigators in Mysuru, Mangaluru, and Hubballi typically handle regional cases independently. For multi-city assignments, confirm how costs are structured — travel time and logistics can vary significantly between metros and regional towns.",
      stateVsCityGuide:
        "If your case is limited to a specific city like Bengaluru or Mysuru, a local investigator may offer faster response and lower costs. For statewide or multi-city work, a Bengaluru-based agency with established field networks is often more reliable. If you need immediate on-the-ground presence in a smaller city, verify the investigator's local contacts before engaging.",
      hiringAdvice:
        "Ask specifically how the investigator will operate in your location — whether they have direct staff, established partners, or rely on case-by-case subcontracting. For cases outside Bengaluru, get written confirmation of coverage and timelines before work begins. Corporate clients should request agency credentials, insurance details, and compliance certifications.",
      relatedServices: [
        {
          name: "Background Checks",
          description: "High-volume service in Karnataka, especially for IT sector hiring and vendor screening",
        },
        {
          name: "Corporate Due Diligence",
          description: "Bengaluru-based demand for business verification, mergers, and financial audits",
        },
        {
          name: "Matrimonial Investigations",
          description: "Common service across all regions; typically handled by local investigators",
        },
        {
          name: "Fraud Detection",
          description: "Growing segment for finance, insurance, and corporate clients",
        },
        {
          name: "Surveillance",
          description: "Available but operationally challenging outside major metros; confirm logistics first",
        },
      ],
      topCitiesInState: [
        {
          name: "Bengaluru",
          description: "Largest market; home to most agencies and corporate work",
        },
        {
          name: "Mysuru",
          description: "Second-largest city; independent investigators serve regional clientele",
        },
        {
          name: "Mangaluru",
          description: "Coastal city with distinct business community and regional investigations",
        },
        {
          name: "Hubballi",
          description: "Northern region center; smaller investigation market but growing",
        },
      ],
      faq: [
        {
          question: "Will a Bengaluru investigator actually cover my case outside the capital?",
          answer:
            "Many will, but their approach varies. Some have established field partners, others subcontract to local investigators. Get the details in writing before engaging — clarity on who does the actual work and how costs are managed matters more than the agency's base location.",
        },
        {
          question: "How much should I budget for travel costs in Karnataka investigations?",
          answer:
            "For cases in Bengaluru or Mysuru, travel is minimal. For Mangaluru or Hubballi, factor in travel time, logistics, and per-diem costs — these can add 30–50% to project costs. Ask the investigator to provide a transparent breakdown before work starts.",
        },
        {
          question: "Which cities in Karnataka have the strongest investigator networks?",
          answer:
            "Bengaluru has the most agencies and infrastructure. Mysuru has reliable independent investigators. Mangaluru and Hubballi have smaller but active markets — you may need to engage local specialists rather than larger Bengaluru firms.",
        },
        {
          question: "What should I confirm before hiring an investigator for a regional case?",
          answer:
            "Confirm how they operate in your specific location (direct staff, partners, or subcontracting), what their local experience is, how communication and reporting will work, and what the total cost — including travel and logistics — will be.",
        },
        {
          question: "Do investigation rules differ between Bengaluru and other Karnataka cities?",
          answer:
            "Rules are statewide, but enforcement and professional standards vary. Bengaluru's large market drives higher professionalization. In smaller cities, fewer agencies mean less competition and potentially less experience with diverse case types.",
        },
      ],
    },
  },
  usa: {
    california: {
      stateOverview:
        "California's investigation market is the largest and most regulated in the US, with strict BSIS licensing requirements ensuring baseline professionalism. The market concentrates in three metros — Los Angeles (largest), San Francisco (tech and finance focus), and San Diego (commercial and legal support) — each with distinct specializations. Outside these metros, investigations are handled by smaller firms or solo practitioners, typically with regional focus and lower regulatory oversight in practice.",
      commonCasesInState:
        "Corporate due diligence and legal support work dominate California's investigation market, driven by the state's large business, tech, and finance sectors. Background checks, surveillance, and asset searches are consistently requested across all regions. Insurance fraud investigation is particularly active. Litigation support — witness location, evidence gathering, deposition preparation — is a major revenue stream for experienced investigators.",
      coverageAndRegionalNotes:
        "LA, San Francisco, and San Diego each have concentrated investigation markets. Regional coverage from these metros is possible but involves travel logistics and per-diem costs. For cases in smaller cities or rural areas, local investigators may be less experienced but more cost-effective for on-the-ground presence. Multi-location cases require clear agreement on which investigator handles which geography.",
      stateVsCityGuide:
        "If your case involves litigation or complex corporate work, a metro-based investigator with BSIS experience and professional connections is usually necessary. For straightforward background checks or local surveillance, a regional investigator may be sufficient and more affordable. If you need work in multiple metros, consider whether to engage separate specialists in each location or negotiate a statewide scope with a larger firm.",
      hiringAdvice:
        "Always verify BSIS licence before engaging. Ask how the investigator handles multi-location assignments, whether they have insurance and errors & omissions coverage, and how they manage CPRA compliance for personal data handling. For legal work, confirm they understand California rules of evidence and have experience with litigation support. Get all terms in a written engagement letter.",
      relatedServices: [
        {
          name: "Background Checks",
          description: "High-volume service across California; regulated by BSIS licensing",
        },
        {
          name: "Litigation Support",
          description: "Major service line in metros; includes witness location, evidence gathering, deposition prep",
        },
        {
          name: "Corporate Due Diligence",
          description: "Strong demand in SF Bay Area and LA; requires sophisticated financial analysis",
        },
        {
          name: "Surveillance",
          description: "Fully licensed service with strict CPRA compliance requirements",
        },
        {
          name: "Asset Searches",
          description: "Common for legal and corporate clients; limited public record availability in CA",
        },
      ],
      topCitiesInState: [
        {
          name: "Los Angeles",
          description: "Largest market; diverse specializations including entertainment, business, legal work",
        },
        {
          name: "San Francisco",
          description: "Tech and finance hub; sophisticated corporate due diligence and compliance work",
        },
        {
          name: "San Diego",
          description: "Commercial and legal support focus; military and government contractor presence",
        },
        {
          name: "Sacramento",
          description: "State capital; smaller but specialized market for government and compliance work",
        },
      ],
      faq: [
        {
          question: "How do I verify a California investigator's BSIS license?",
          answer:
            "Visit the California Department of Consumer Affairs website (dca.ca.gov), search the Investigator License Database, and confirm the license is current and has no disciplinary actions. This is free and takes 2 minutes — it's non-negotiable before engaging any investigator in California.",
        },
        {
          question: "What does CPRA compliance mean for my investigation?",
          answer:
            "CPRA is California's data privacy law. Investigators must handle personal information carefully — limiting collection, explaining use, and protecting storage. If your case involves personal data (addresses, phone numbers, financial info), confirm the investigator documents their CPRA compliance process in writing.",
        },
        {
          question: "Should I hire separate investigators in different California metros?",
          answer:
            "For straightforward cases, one investigator can coordinate multi-location work. For complex litigation or highly specialized corporate work, separate metro specialists with local networks may be more effective — and often more cost-efficient than one firm traveling statewide.",
        },
        {
          question: "What should a written engagement letter include?",
          answer:
            "Scope of work, rate structure (hourly or fixed), expenses covered, how communication/reporting works, timeline, confidentiality terms, and CPRA/compliance practices. California investigators routinely provide this — if they resist, that's a red flag.",
        },
        {
          question: "How much more expensive is a metro investigator vs. a regional one?",
          answer:
            "Metro investigators typically charge 15–40% more than regional specialists, reflecting market concentration, specialization, and overhead. For simple work, a regional investigator may be sufficient. For legal support or complex corporate cases, the metro rate is usually worth it for quality and network access.",
        },
      ],
    },
  },
  "united-kingdom": {
    "greater-london": {
      stateOverview:
        "London's investigation market is the UK's largest and most sophisticated, dominated by agencies with professional body memberships (ABI, PRIVA) and ICO registration. The market serves corporate, legal, and personal clients with distinct specializations by firm size and experience. Investigation standards are high, though the absence of mandatory licensing means quality varies more than in regulated jurisdictions. Outside central London, investigators operate through local networks or with regional partners.",
      commonCasesInState:
        "London dominates UK litigation support work — witness location, evidence gathering, and deposition preparation are major revenue streams. Background checks and corporate due diligence are consistent, driven by financial, legal, and business sectors. Matrimonial investigations and asset tracing are common personal client work. Workplace investigations for HR and compliance teams are a growing segment, particularly in financial services.",
      coverageAndRegionalNotes:
        "Central London (City, West End, South Bank) has the highest concentration of agencies. Greater London boroughs are served by central firms or local investigators, typically through partnerships. For cases requiring presence across multiple boroughs, confirm whether the investigator has direct staff, established local contacts, or will subcontract — costs and response times vary accordingly.",
      stateVsCityGuide:
        "For central London cases (law firms, financial institutions, corporate HQs), a west-end or city-based investigator with professional connections is usually necessary. For suburban or borough-specific work, a local investigator may be faster and more cost-effective. If you need multi-borough coverage, clarify whether the investigator operates independently or through a network.",
      hiringAdvice:
        "Verify ICO registration and ask about professional body membership (ABI, PRIVA, IPHA). For legal work, confirm understanding of UK law and evidence rules. Ask how personal data is handled under UK GDPR and the Data Protection Act 2018 — reputable investigators will have clear written processes. Request professional indemnity insurance details and references from similar past cases.",
      relatedServices: [
        {
          name: "Litigation Support",
          description: "Major London specialization; includes witness location, evidence prep, deposition support",
        },
        {
          name: "Background Checks",
          description: "High-volume service; regulated by ICO compliance and GDPR rules",
        },
        {
          name: "Corporate Due Diligence",
          description: "Strong service line for M&A, vendor verification, and business risk assessment",
        },
        {
          name: "Asset Tracing",
          description: "Specialized service often linked to litigation or financial investigation work",
        },
        {
          name: "Workplace Investigations",
          description: "Growing segment for HR compliance and employment law support",
        },
      ],
      topCitiesInState: [
        {
          name: "Central London (City of London)",
          description: "Financial and legal epicenter; agencies here handle high-value corporate and litigation work",
        },
        {
          name: "Westminster",
          description: "Government and law firm hub; strong litigation support and political/corporate investigation focus",
        },
        {
          name: "Canary Wharf",
          description: "Financial district; agencies serve banking, insurance, and corporate clients",
        },
        {
          name: "South London (Brixton, Croydon)",
          description: "Larger coverage area; mix of corporate and personal investigations with lower rates",
        },
      ],
      faq: [
        {
          question: "Is there a licensing body for London investigators?",
          answer:
            "No mandatory license in England and Wales. However, reputable London investigators typically hold ICO registration (required for handling personal data) and membership in professional bodies like the Association of British Investigators (ABI), PRIVA, or IPHA. These are strong quality signals.",
        },
        {
          question: "What does ICO registration mean for my investigation?",
          answer:
            "ICO registration shows the investigator is registered to handle personal data under UK GDPR and Data Protection Act rules. Reputable London firms hold this. It's evidence they follow legal data handling practices — you can verify registration on the ICO website.",
        },
        {
          question: "How much should professional indemnity insurance cost?",
          answer:
            "Most reputable London investigators carry professional indemnity insurance covering errors or omissions. This shouldn't directly cost you, but it's a sign of professional standards. Ask for proof of coverage — it shows they're serious about liability.",
        },
        {
          question: "What's the difference between a central London firm and a local investigator?",
          answer:
            "Central London firms (City, West End) have more infrastructure, broader networks, and higher rates — they're optimized for complex litigation and corporate work. Local investigators have lower overhead, may offer faster response for local cases, and typically charge less. The right choice depends on case complexity and location.",
        },
        {
          question: "Can a London investigator work on cases across multiple UK cities?",
          answer:
            "Yes, but clarify how. Most operate primarily in London and use partner networks for regional work. Confirm coverage, cost structure, and who actually performs the work in other locations before engaging.",
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
): StateContent | undefined {
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
