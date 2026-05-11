import React, { useMemo } from "react";

interface LocationIntelligenceBlockProps {
  level: "country"; // PHASE 1: country only
  countryName: string;
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
 * Reusable component for location-specific guidance and FAQs.
 * PHASE 1: Country-level content only (India, US, UK)
 *
 * Supports future scaling to state/city levels via the "level" prop.
 *
 * Design:
 * - Rendered in page flow (full width of content area)
 * - Semantic article structure with h3 subheadings
 * - Readable paragraph spacing for guidance content
 * - FAQ is intentionally NOT rendered here (single FAQ source remains page template)
 */
export const LocationIntelligenceBlock: React.FC<
  LocationIntelligenceBlockProps
> = ({
  level,
  countryName,
  detectiveCount,
  lastUpdated,
  content,
}) => {
  // Phase 1: Country level only
  if (level !== "country" || !content) {
    return null;
  }

  const displayCountryName = useMemo(() => {
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
  }, [countryName]);

  return (
    <article className="my-12">
      <header className="mb-8 border-b border-slate-200 pb-5">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Hiring a Private Detective in {displayCountryName}
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
        <h3 className="text-lg font-semibold text-slate-900">Intro Overview</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{content.intro}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">Common Investigation Services</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{content.commonServices}</p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900">Hiring Guidance</h3>
        <p className="mt-3 text-[15px] leading-8 text-slate-700">{content.hiringGuidance}</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-900">Trust & Confidentiality</h3>
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
