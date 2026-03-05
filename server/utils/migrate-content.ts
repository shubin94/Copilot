import { ContentBlock, stringifyContentBlocks } from "../../client/src/shared/content-blocks";

/**
 * Migrate existing plain-text or HTML content to JSON block format.
 * This is used during database migrations to convert legacy content.
 * 
 * Rules:
 * - If content is already valid JSON blocks, return as-is
 * - If content looks like HTML, try to preserve it as a single paragraph
 * - If content is plain text, wrap it in a paragraph block
 * - Empty content becomes an empty array (will be validated later)
 */
export function migrateContentToBlocks(content: string | null | undefined): string {
  if (!content || !content.trim()) {
    // Return empty JSON array - will be validated when saving
    return JSON.stringify([]);
  }

  // Check if already valid JSON
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      // Validate it's a block array
      const isValidBlocks = parsed.every(
        (block) =>
          block &&
          typeof block === "object" &&
          ["heading", "paragraph", "image", "video", "shortcode"].includes(block.type)
      );
      if (isValidBlocks) {
        return content; // Already migrated
      }
    }
  } catch {
    // Not JSON, continue
  }

  // Check if it looks like HTML (contains tags)
  if (/<[^>]+>/.test(content)) {
    // For HTML content, we'll preserve it as a paragraph
    // A more advanced version could parse HTML and create appropriate blocks
    const blocks: ContentBlock[] = [
      {
        type: "paragraph",
        text: content, // Preserve original HTML-ish content
      },
    ];
    return stringifyContentBlocks(blocks);
  }

  // Plain text - wrap in paragraph block
  const blocks: ContentBlock[] = [
    {
      type: "paragraph",
      text: content,
    },
  ];
  return stringifyContentBlocks(blocks);
}

/**
 * Example migration script to run against existing database.
 * 
 * Usage (in a .ts file):
 * ```
 * import { pool } from "./db/index.ts";
 * import { migrateContentToBlocks } from "./server/utils/migrate-content.ts";
 * 
 * async function runMigration() {
 *   try {
 *     const pages = await pool.query("SELECT id, content FROM pages");
 *     
 *     for (const page of pages.rows) {
 *       const newContent = migrateContentToBlocks(page.content);
 *       await pool.query(
 *         "UPDATE pages SET content = $1 WHERE id = $2",
 *         [newContent, page.id]
 *       );
 *       console.log(`✅ Migrated page: ${page.id}`);
 *     }
 *     
 *     console.log("✅ Migration complete!");
 *   } catch (error) {
 *     console.error("❌ Migration failed:", error);
 *   }
 * }
 * 
 * runMigration();
 * ```
 */
