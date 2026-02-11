import React from "react";
import {
  ContentBlock,
  HeadingBlock,
  ParagraphBlock,
  ImageBlock,
  VideoBlock,
  ShortcodeBlock,
} from "@/shared/content-blocks";
import { DetectiveSnippetGrid } from "@/components/snippets/detective-snippet-grid";

// Utility: Extract embed URL from YouTube/Vimeo URL
function getEmbedUrl(url: string): string | null {
  // YouTube: https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo: https://vimeo.com/VIDEO_ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

// Block renderers
function renderHeadingBlock(block: HeadingBlock): React.ReactNode {
  const Tag = block.level as keyof JSX.IntrinsicElements;
  const headingClasses = {
    h1: "text-4xl md:text-5xl font-bold text-gray-900 mb-6",
    h2: "text-3xl md:text-4xl font-bold text-gray-900 mb-5",
    h3: "text-2xl md:text-3xl font-bold text-gray-900 mb-4",
    h4: "text-xl md:text-2xl font-bold text-gray-900 mb-3",
  };

  return (
    <Tag className={headingClasses[block.level]} key={Math.random()}>
      {block.text}
    </Tag>
  );
}

function renderParagraphBlock(block: ParagraphBlock): React.ReactNode {
  const trimmed = block.text.trim();
  const snippetId = parseDetectiveSnippetId(trimmed);
  if (snippetId && isSnippetOnly(trimmed)) {
    return (
      <div className="my-8" key={Math.random()}>
        <DetectiveSnippetGrid snippetId={snippetId} />
      </div>
    );
  }
  return (
    <p className="text-gray-800 text-lg leading-relaxed mb-6 whitespace-pre-wrap" key={Math.random()}>
      {block.text}
    </p>
  );
}

function renderImageBlock(block: ImageBlock): React.ReactNode {
  return (
    <figure className="my-8" key={Math.random()}>
      <img
        src={block.url}
        alt={block.alt || ""}
        className="w-full h-auto rounded-lg shadow-md"
        loading="lazy"
      />
      {block.caption && (
        <figcaption className="text-center text-sm text-gray-600 mt-3">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function renderVideoBlock(block: VideoBlock): React.ReactNode {
  const embedUrl = getEmbedUrl(block.url);

  if (!embedUrl) {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded p-4 my-6 text-center" key={Math.random()}>
        <p className="text-gray-600 text-sm">Invalid video URL</p>
      </div>
    );
  }

  return (
    <div className="my-8" key={Math.random()}>
      <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embedUrl}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
        ></iframe>
      </div>
      {block.caption && (
        <p className="text-center text-sm text-gray-600 mt-3">
          {block.caption}
        </p>
      )}
    </div>
  );
}

// Parse [detective_snippet id="xxx"], snippetId="xxx", or <DetectiveSnippetGrid snippetId="xxx" />
function parseDetectiveSnippetId(value: string): string | null {
  const trimmed = value.trim();
  const bracketMatch = trimmed.match(/\[detective_snippet\s+id=["']([^"']+)["']\s*\]/i);
  if (bracketMatch) return bracketMatch[1].trim();
  const attrMatch = trimmed.match(/snippetId=["']([^"']+)["']/i);
  if (attrMatch) return attrMatch[1].trim();
  const jsxMatch = trimmed.match(/<DetectiveSnippetGrid\s+snippetId=["']([^"']+)["']\s*\/?\s*>/i);
  if (jsxMatch) return jsxMatch[1].trim();
  return null;
}

function isSnippetOnly(value: string): boolean {
  return (
    /^\s*\[detective_snippet\s+id=["'][^"']+["']\s*\]\s*$/i.test(value) ||
    /^\s*<DetectiveSnippetGrid\s+snippetId=["'][^"']+["']\s*\/?\s*>\s*$/i.test(value)
  );
}

function renderShortcodeBlock(block: ShortcodeBlock): React.ReactNode {
  const snippetId = parseDetectiveSnippetId(block.value);
  if (snippetId) {
    return (
      <div className="my-8" key={Math.random()}>
        <DetectiveSnippetGrid snippetId={snippetId} />
      </div>
    );
  }
  return (
    <div className="bg-amber-50 border border-amber-300 rounded p-4 my-6" key={Math.random()}>
      <p className="text-sm text-amber-800 font-mono">{block.value}</p>
      <p className="text-xs text-amber-600 mt-2">
        ℹ️ Shortcode not recognized. Use [detective_snippet id=&quot;your-snippet-id&quot;] for detective grids.
      </p>
    </div>
  );
}

// Main renderer
export function renderBlock(block: ContentBlock): React.ReactNode {
  switch (block.type) {
    case "heading":
      return renderHeadingBlock(block);
    case "paragraph":
      return renderParagraphBlock(block);
    case "image":
      return renderImageBlock(block);
    case "video":
      return renderVideoBlock(block);
    case "shortcode":
      return renderShortcodeBlock(block);
    default:
      return null;
  }
}

export function renderBlocks(blocks: ContentBlock[]): React.ReactNode {
  return blocks.map((block, index) => (
    <div key={index}>
      {renderBlock(block)}
    </div>
  ));
}
