/**
 * Shared location and slug normalization helpers.
 * Keep these transformations deterministic and side-effect free.
 */

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeWhitespace(value: string | undefined | null): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeSlugSegment(value: string | undefined | null): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeRouteSlugParam(value: string | undefined | null): string {
  return normalizeSlugSegment(safeDecodeURIComponent(String(value || "")));
}

export function toTitleFromSlug(value: string | undefined | null): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}
