import React, { useMemo } from "react";

interface CountryContentType {
  intro: string;
  commonServices: string;
  hiringGuidance: string;
  confidentiality: string;
  faq: Array<{
    question: string;
    answer: string;
  }>;
}

interface StateContentType {
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

interface LocationMetadata {
  displayLocationName: string;
  countrySlug: string;
  stateSlug?: string;
  detectiveCount: number;
  lastUpdated?: string;
}

// ============================================================
// STATE-LEVEL INTELLIGENCE VIEW
// ============================================================
const StateIntelligenceView: React.FC<{
  content: StateContentType;
  metadata: LocationMetadata;
}> = ({ content, metadata }) => {
  const { displayLocationName, countrySlug, stateSlug, detectiveCount, lastUpdated } = metadata;

  // State-specific service links (for potential future use in state content rendering)
  const commonServiceLinks = useMemo(
    () => [
      { label: "Background Checks", slug: "background-checks" },
      { label: "Surveillance", slug: "surveillance" },
      { label: "Asset Searches", slug: "asset-search" },
      { label: "Matrimonial Investigations", slug: "matrimonial-investigation" },
      { label: "Fraud Investigations", slug: "fraud-investigation" },
    ],
    [],
  );

  // Render service links with state-specific routing
  const renderStateServiceText = (text: string) => {
    const escapedTerms = commonServiceLinks
      .map((service) => service.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    if (!escapedTerms) {
      return text;
    }

    const regex = new RegExp(`(${escapedTerms})`, "gi");
    const segments = text.split(regex);

    return segments.map((segment, index) => {
      const service = commonServiceLinks.find(
        (item) => item.label.toLowerCase() === segment.toLowerCase(),
      );

      if (!service) {
        return <React.Fragment key={`segment-${index}`}>{segment}</React.Fragment>;
      }

      // State-level: include stateSlug in href for regional routing
      const href = stateSlug
        ? `/locations/${service.slug}/${countrySlug}/${stateSlug}/`
        : `/locations/${service.slug}/${countrySlug}/`;

      return (
        <a
          key={`segment-${index}`}
          href={href}
          className="text-blue-700 underline underline-offset-2 hover:text-blue-800"
        >
          {segment}
        </a>
      );
    });
  };

  return (
    <article className="my-12">
      <header className="mb-8 border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Hiring a Private Detective in {displayLocationName}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Regional guidance for finding investigators, understanding coverage, and comparing specialists.
        </p>
        {detectiveCount > 0 && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {detectiveCount.toLocaleString()} verified detectives currently listed
          </p>
        )}
      </header>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">{displayLocationName} Investigation Market Overview</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{renderStateServiceText(content.stateOverview)}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">Common Cases in {displayLocationName}</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{renderStateServiceText(content.commonCasesInState)}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">Coverage & Regional Considerations</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{renderStateServiceText(content.coverageAndRegionalNotes)}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">{displayLocationName} vs City — Which Investigator to Choose?</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{renderStateServiceText(content.stateVsCityGuide)}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">How to Hire in {displayLocationName}</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{renderStateServiceText(content.hiringAdvice)}</p>
      </section>

      {content.relatedServices && content.relatedServices.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900">Investigation Services Available</h3>
          <ul className="mt-4 space-y-3">
            {content.relatedServices.map((service, index) => (
              <li key={`service-${index}`} className="text-[15px] leading-7 text-slate-700">
                <strong className="text-slate-900">{service.name}:</strong> {service.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {content.topCitiesInState && content.topCitiesInState.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900">Key Cities in {displayLocationName}</h3>
          <ul className="mt-4 space-y-3">
            {content.topCitiesInState.map((city, index) => (
              <li key={`city-${index}`} className="text-[15px] leading-7 text-slate-700">
                <strong className="text-slate-900">{city.name}:</strong>{" "}
                {city.description || "Investigation services available in this city."}
              </li>
            ))}
          </ul>
        </section>
      )}

      {lastUpdated && (() => {
        try {
          const d = new Date(lastUpdated);
          const formatted = d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          return (
            <footer className="mt-8 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">Last updated: {formatted}</p>
            </footer>
          );
        } catch {
          return null;
        }
      })()}
    </article>
  );
};

// ============================================================
// COUNTRY-LEVEL INTELLIGENCE VIEW
// ============================================================
const CountryIntelligenceView: React.FC<{
  content: CountryContentType;
  metadata: LocationMetadata;
}> = ({ content, metadata }) => {
  const { displayLocationName, countrySlug, detectiveCount, lastUpdated } = metadata;

  const commonServiceLinks = useMemo(
    () => [
      { label: "Background Checks", slug: "background-checks" },
      { label: "Surveillance", slug: "surveillance" },
      { label: "Asset Searches", slug: "asset-search" },
      { label: "Matrimonial Investigations", slug: "matrimonial-investigation" },
      { label: "Fraud Investigations", slug: "fraud-investigation" },
    ],
    [],
  );

  const renderCommonServicesText = (text: string) => {
    const escapedTerms = commonServiceLinks
      .map((service) => service.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    if (!escapedTerms) {
      return text;
    }

    const regex = new RegExp(`(${escapedTerms})`, "gi");
    const segments = text.split(regex);

    return segments.map((segment, index) => {
      const service = commonServiceLinks.find(
        (item) => item.label.toLowerCase() === segment.toLowerCase(),
      );

      if (!service) {
        return <React.Fragment key={`segment-${index}`}>{segment}</React.Fragment>;
      }

      const href = `/locations/${service.slug}/${countrySlug}/`;

      return (
        <a
          key={`segment-${index}`}
          href={href}
          className="text-blue-700 underline underline-offset-2 hover:text-blue-800"
        >
          {segment}
        </a>
      );
    });
  };

  return (
    <article className="my-12">
      <header className="mb-8 border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Hiring a Private Detective in {displayLocationName}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Practical guidance to evaluate investigators, compare services, and hire with confidence.
        </p>
        {detectiveCount > 0 && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {detectiveCount.toLocaleString()} verified detectives currently listed
          </p>
        )}
      </header>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">About the Market</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{content.intro}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">Common Investigation Services</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{renderCommonServicesText(content.commonServices)}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">How to Hire</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{content.hiringGuidance}</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-900">Privacy & Confidentiality</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{content.confidentiality}</p>
      </section>

      {lastUpdated && (() => {
        try {
          const d = new Date(lastUpdated);
          const formatted = d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          return (
            <footer className="mt-8 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">Last updated: {formatted}</p>
            </footer>
          );
        } catch {
          return null;
        }
      })()}
    </article>
  );
};

// ============================================================
// MAIN ORCHESTRATOR COMPONENT
// ============================================================

interface LocationIntelligenceBlockProps {
  level: "country" | "state";
  countryName: string;
  stateName?: string;
  countrySlug?: string;
  stateSlug?: string;
  detectiveCount: number;
  topServices?: string[];
  lastUpdated?: string;
  content?: CountryContentType | StateContentType;
}

/**
 * LocationIntelligenceBlock
 *
 * Orchestrator component for location-specific guidance.
 * - Country pages: National market context, common services, hiring guidance, privacy
 * - State pages: Regional operations, geographic coverage, state vs city decision, top cities
 *
 * Delegates rendering to specialized sub-components:
 * - StateIntelligenceView: Dedicated state-level structure with state-specific service routing
 * - CountryIntelligenceView: Country-level structure and semantics
 */
export const LocationIntelligenceBlock: React.FC<LocationIntelligenceBlockProps> = ({
  level,
  countryName,
  stateName,
  countrySlug: countrySlugProp,
  stateSlug: stateSlugProp,
  detectiveCount,
  lastUpdated,
  content,
}) => {
  if (!content) {
    return null;
  }

  const isStateLevel = level === "state";

  const displayLocationName = useMemo(() => {
    if (isStateLevel && stateName) {
      return stateName
        .replace(/[-_]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
    }

    const aliases: Record<string, string> = {
      india: "India",
      in: "India",
      usa: "United States",
      us: "United States",
      "united states": "United States",
      "united-states": "United States",
      uk: "United Kingdom",
      gb: "United Kingdom",
      "great britain": "United Kingdom",
      "great-britain": "United Kingdom",
      "united kingdom": "United Kingdom",
      "united-kingdom": "United Kingdom",
    };

    const normalized = (countryName || "").trim().toLowerCase();
    if (aliases[normalized]) {
      return aliases[normalized];
    }

    return (countryName || "")
      .replace(/[-_]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }, [isStateLevel, countryName, stateName]);

  const countrySlug = useMemo(() => {
    if (countrySlugProp) return countrySlugProp;
    const normalized = (countryName || "").trim().toLowerCase();
    if (normalized === "india" || normalized === "in") return "india";
    if (normalized === "usa" || normalized === "us" || normalized === "united states" || normalized === "united-states") {
      return "united-states";
    }
    if (
      normalized === "uk" ||
      normalized === "gb" ||
      normalized === "great britain" ||
      normalized === "great-britain" ||
      normalized === "united kingdom" ||
      normalized === "united-kingdom"
    ) {
      return "united-kingdom";
    }
    return normalized.replace(/\s+/g, "-");
  }, [countryName, countrySlugProp]);

  // Type guard for country content
  const isCountryContent = (c: any): c is CountryContentType => {
    return "intro" in c && "commonServices" in c;
  };

  // Type guard for state content
  const isStateContent = (c: any): c is StateContentType => {
    return "stateOverview" in c && "commonCasesInState" in c;
  };

  const metadata: LocationMetadata = {
    displayLocationName,
    countrySlug,
    stateSlug: stateSlugProp,
    detectiveCount,
    lastUpdated,
  };

  if (isStateLevel && isStateContent(content)) {
    return <StateIntelligenceView content={content} metadata={metadata} />;
  }

  if (!isStateLevel && isCountryContent(content)) {
    return <CountryIntelligenceView content={content} metadata={metadata} />;
  }

  return null;
};

export default LocationIntelligenceBlock;
