/**
 * Shared slug generation utility
 * Used across location routes, detective routes, and other URL generation logic
 * This is the single source of truth for slug generation to ensure URL consistency
 */

/**
 * Generate URL-safe slugs from text
 * Converts: "New York City" -> "new-york-city"
 * Cleans: Special characters, multiple spaces, leading/trailing hyphens
 */
export function generateSlug(text: string): string {
  if (!text) return "unknown";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Normalize text for matching purposes (search, slug comparison)
 * Used when matching raw detective text fields against normalized database entries
 */
export function normalizeForMatch(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}
