// WordPress-like block structure for CMS pages
// Supports SEO-friendly structured content

import { z } from "zod";

// ============== BLOCK TYPES ==============

export interface HeadingBlock {
  type: "heading";
  level: "h1" | "h2" | "h3" | "h4";
  text: string;
}

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
}

export interface ImageBlock {
  type: "image";
  url: string;
  alt?: string;
  caption?: string;
}

export interface VideoBlock {
  type: "video";
  url: string; // YouTube or Vimeo URL
  caption?: string;
}

export interface ShortcodeBlock {
  type: "shortcode";
  value: string; // e.g., [contact_form], [cta], [faq]
}

export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | VideoBlock
  | ShortcodeBlock;

export type BlockType = ContentBlock["type"];

// ============== VALIDATION SCHEMAS ==============

export const headingBlockSchema = z.object({
  type: z.literal("heading"),
  level: z.enum(["h1", "h2", "h3", "h4"]),
  text: z.string().min(1, "Heading text is required"),
});

export const paragraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: z.string().min(1, "Paragraph text is required"),
});

export const imageBlockSchema = z.object({
  type: z.literal("image"),
  url: z
    .string()
    .min(1, "Image URL is required")
    .refine(
      (value) => value.startsWith("data:") || /^https?:\/\//i.test(value),
      "Image URL must be a valid URL or data URL"
    ),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const videoBlockSchema = z.object({
  type: z.literal("video"),
  url: z
    .string()
    .url("Video URL must be valid")
    .refine(
      (url) =>
        url.includes("youtube.com") ||
        url.includes("youtu.be") ||
        url.includes("vimeo.com"),
      "Video URL must be from YouTube or Vimeo"
    ),
  caption: z.string().optional(),
});

export const shortcodeBlockSchema = z.object({
  type: z.literal("shortcode"),
  value: z.string().min(1, "Shortcode is required"),
});

export const contentBlockSchema = z.union([
  headingBlockSchema,
  paragraphBlockSchema,
  imageBlockSchema,
  videoBlockSchema,
  shortcodeBlockSchema,
]);

export const contentBlocksSchema = z.array(contentBlockSchema).min(1, "At least one block is required");

// Type guards
export function isHeadingBlock(block: ContentBlock): block is HeadingBlock {
  return block.type === "heading";
}

export function isParagraphBlock(block: ContentBlock): block is ParagraphBlock {
  return block.type === "paragraph";
}

export function isImageBlock(block: ContentBlock): block is ImageBlock {
  return block.type === "image";
}

export function isVideoBlock(block: ContentBlock): block is VideoBlock {
  return block.type === "video";
}

export function isShortcodeBlock(block: ContentBlock): block is ShortcodeBlock {
  return block.type === "shortcode";
}

// Utility: Convert JSON string to blocks array
export function parseContentBlocks(content: string | ContentBlock[]): ContentBlock[] {
  // If already an array, validate and return
  if (Array.isArray(content)) {
    try {
      return contentBlocksSchema.parse(content);
    } catch {
      return [];
    }
  }

  // Try parsing as JSON
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return contentBlocksSchema.parse(parsed);
      }
    } catch {
      // If not valid JSON, create a single paragraph block for backward compatibility
      if (content.trim()) {
        return [{ type: "paragraph", text: content }];
      }
    }
  }

  return [];
}

// Utility: Convert blocks to JSON string for storage
export function stringifyContentBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks);
}
