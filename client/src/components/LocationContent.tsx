import React from "react";

interface LocationContentProps {
  country: string;
  state?: string;
  city?: string;
}

export const LocationContent: React.FC<LocationContentProps> = ({ country, state, city }) => {
  // Helper to capitalize first letter
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  if (city && state && country) {
    // City-level content
    return (
      <section className="location-content">
        <h2>Private Detectives in {cap(city)}</h2>
        <p>
          Private detectives in {cap(city)}, {cap(state)} assist individuals and businesses with professional investigation services. Common services include background verification, surveillance investigations, corporate fraud investigations, and missing person searches. Professional investigators in {cap(city)} often combine traditional field surveillance with modern digital investigation techniques to gather reliable evidence while maintaining strict confidentiality.
        </p>
        <p>
          This directory helps you compare verified detectives in {cap(city)} based on their experience, services offered, and service areas. Whether you need to investigate a personal matter or require corporate due diligence, you can find trusted professionals in {cap(city)} who adhere to the highest ethical standards.
        </p>
        <p>
          Choosing a local detective in {cap(city)} ensures familiarity with the area and access to local resources, which can be critical for time-sensitive investigations. Browse our listings to find the right investigator for your needs in {cap(city)}, {cap(state)}.
        </p>
      </section>
    );
  }

  if (state && country) {
    // State-level content
    return (
      <section className="location-content">
        <h2>Investigation Services in {cap(state)}</h2>
        <p>
          Private investigators in {cap(state)}, {cap(country)} operate across major cities and provide investigation services for individuals, businesses, and legal professionals. These services often include background checks, corporate investigations, surveillance operations, and pre-marital verification. Detectives in {cap(state)} are experienced in handling sensitive cases and maintaining client confidentiality at all times.
        </p>
        <p>
          Our directory features agencies and independent detectives from {cap(state)} who are equipped to handle a wide range of cases, from personal investigations to complex corporate matters. You can compare professionals based on their expertise, client reviews, and service offerings.
        </p>
        <p>
          Whether you are in a metropolitan area or a smaller city within {cap(state)}, you can find reliable investigative support tailored to your requirements.
        </p>
      </section>
    );
  }

  if (country) {
    // Country-level content
    return (
      <section className="location-content">
        <h2>Private Detectives in {cap(country)}</h2>
        <p>
          Private investigation services in {cap(country)} support both personal and corporate investigative needs. Investigation agencies assist clients with surveillance, background verification, corporate investigations, and legal evidence collection. Detectives in {cap(country)} are skilled in using both traditional and modern investigative techniques to deliver results efficiently and discreetly.
        </p>
        <p>
          Our platform connects you with licensed and verified private detectives across {cap(country)}. Whether you need to resolve a personal issue, conduct a background check, or investigate corporate fraud, you can find the right professional for your case.
        </p>
        <p>
          Explore our listings to compare detective agencies and independent investigators in {cap(country)}. Each profile includes details about services offered, areas served, and client testimonials to help you make an informed decision.
        </p>
      </section>
    );
  }

  return null;
};
