import React, { useMemo } from "react";

interface LocationIntelligenceBlockProps {
  level: "country" | "state";
  countryName: string;
  stateName?: string;       // required when level="state"
  countrySlug?: string;     // used for state-level service links
  stateSlug?: string;       // used for state-level service links
  detectiveCount: number;
  topServices?: string[];
  lastUpdated?: string;
  content?: {
    intro: string;
    commonServices: string;
    hiringGuidance: string;
    confidentiality: string;
    faq: Array<{
      question: string;
      answer: string;
    }>;
  };
}

/**
 * LocationIntelligenceBlock
 *
 * Reusable component for location-specific guidance.
 * PHASE 1: Country-level content (India, US, UK)
 * PHASE 2: State-level content (Karnataka, California, Greater London)
 *
 * Design:
 * - Rendered in page flow (full width of content area)
 * - Semantic article structure with h3 subheadings
 * - Readable paragraph spacing for guidance content
 * - FAQ intentionally NOT rendered here (single FAQ source remains page template)
 */
export const LocationIntelligenceBlock: React.FC<
  LocationIntelligenceBlockProps
> = ({
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

  const displayLocationName = useMemo(() => {
    if (level === "state" && stateName) {
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
  }, [level, countryName, stateName]);

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

      // State-level: link to service+state page; country-level: link to service+country page
      const href = level === "state" && stateSlugProp
        ? `/locations/${service.slug}/${countrySlug}/${stateSlugProp}/`
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
            Practical guidance to evaluate investigators, compare services, and
            hire with confidence.
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

      {/* Metadata Footer - only renders if SSR provided a real timestamp */}
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

      {/* FAQ intentionally excluded here. Page-level template FAQ remains the single source. */}
    </article>
  );
};

export default LocationIntelligenceBlock;

