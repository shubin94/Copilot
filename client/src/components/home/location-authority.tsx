/**
 * LocationAuthority Component
 * 
 * Renders the homepage authority section (location links for SEO).
 * Receives pre-generated HTML as a prop from parent.
 * 
 * This approach:
 * - No state, no useEffect, no window dependency in component
 * - Receives static HTML prop from parent
 * - Renders unconditionally and synchronously
 * - Clean, simple CSR rendering
 */

interface LocationAuthorityProps {
  html: string;
}

export function LocationAuthority({ html }: LocationAuthorityProps) {
  console.log("[LocationAuthority] Rendering, html available:", !!html, "size:", html?.length || 0);
  
  // If no HTML provided, don't render
  if (!html) {
    console.warn("[LocationAuthority] No HTML provided, not rendering");
    return null;
  }

  console.log("[LocationAuthority] Rendering with HTML content");
  return (
    <div
      id="ssr-location-section"
      className="location-authority-section"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

