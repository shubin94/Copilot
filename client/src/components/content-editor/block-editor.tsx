import React, { useState } from "react";
import { ContentBlock, stringifyContentBlocks } from "@/shared/content-blocks";
import { HeadingBlockEditor } from "./heading-block";
import { ParagraphBlockEditor } from "./paragraph-block";
import { ImageBlockEditor } from "./image-block";
import { VideoBlockEditor } from "./video-block";
import { ShortcodeBlockEditor } from "./shortcode-block";
import { Plus } from "lucide-react";

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [expandedAddMenu, setExpandedAddMenu] = useState(false);

  const handleAddBlock = (type: ContentBlock["type"]) => {
    let newBlock: ContentBlock;

    switch (type) {
      case "heading":
        newBlock = { type: "heading", level: "h2", text: "" };
        break;
      case "paragraph":
        newBlock = { type: "paragraph", text: "" };
        break;
      case "image":
        newBlock = { type: "image", url: "", alt: "" };
        break;
      case "video":
        newBlock = { type: "video", url: "" };
        break;
      case "shortcode":
        newBlock = { type: "shortcode", value: "" };
        break;
      default:
        return;
    }

    onChange([...blocks, newBlock]);
    setExpandedAddMenu(false);
  };

  const handleUpdateBlock = (index: number, updatedBlock: ContentBlock) => {
    const newBlocks = [...blocks];
    newBlocks[index] = updatedBlock;
    onChange(newBlocks);
  };

  const handleRemoveBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    if (direction === "up" && index > 0) {
      [newBlocks[index], newBlocks[index - 1]] = [
        newBlocks[index - 1],
        newBlocks[index],
      ];
    } else if (direction === "down" && index < blocks.length - 1) {
      [newBlocks[index], newBlocks[index + 1]] = [
        newBlocks[index + 1],
        newBlocks[index],
      ];
    }
    onChange(newBlocks);
  };

  return (
    <div className="space-y-4">
      {/* Blocks List */}
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={index}>
            {block.type === "heading" && (
              <HeadingBlockEditor
                block={block}
                index={index}
                onChange={(updated) => handleUpdateBlock(index, updated)}
                onRemove={() => handleRemoveBlock(index)}
                onMoveUp={() => handleMoveBlock(index, "up")}
                onMoveDown={() => handleMoveBlock(index, "down")}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            )}
            {block.type === "paragraph" && (
              <ParagraphBlockEditor
                block={block}
                index={index}
                onChange={(updated) => handleUpdateBlock(index, updated)}
                onRemove={() => handleRemoveBlock(index)}
                onMoveUp={() => handleMoveBlock(index, "up")}
                onMoveDown={() => handleMoveBlock(index, "down")}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            )}
            {block.type === "image" && (
              <ImageBlockEditor
                block={block}
                index={index}
                onChange={(updated) => handleUpdateBlock(index, updated)}
                onRemove={() => handleRemoveBlock(index)}
                onMoveUp={() => handleMoveBlock(index, "up")}
                onMoveDown={() => handleMoveBlock(index, "down")}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            )}
            {block.type === "video" && (
              <VideoBlockEditor
                block={block}
                index={index}
                onChange={(updated) => handleUpdateBlock(index, updated)}
                onRemove={() => handleRemoveBlock(index)}
                onMoveUp={() => handleMoveBlock(index, "up")}
                onMoveDown={() => handleMoveBlock(index, "down")}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            )}
            {block.type === "shortcode" && (
              <ShortcodeBlockEditor
                block={block}
                index={index}
                onChange={(updated) => handleUpdateBlock(index, updated)}
                onRemove={() => handleRemoveBlock(index)}
                onMoveUp={() => handleMoveBlock(index, "up")}
                onMoveDown={() => handleMoveBlock(index, "down")}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add Block Button */}
      <div className="relative">
        <button
          onClick={() => setExpandedAddMenu(!expandedAddMenu)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded font-medium text-sm transition"
        >
          <Plus size={18} />
          Add Block
        </button>

        {expandedAddMenu && (
          <div className="absolute mt-2 bg-white border rounded-lg shadow-lg z-10 min-w-48">
            <button
              onClick={() => handleAddBlock("heading")}
              className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b"
            >
              <div className="font-medium">Heading</div>
              <div className="text-xs text-gray-500">H1-H4 for structure</div>
            </button>
            <button
              onClick={() => handleAddBlock("paragraph")}
              className="w-full text-left px-4 py-2 hover:bg-green-50 border-b"
            >
              <div className="font-medium">Paragraph</div>
              <div className="text-xs text-gray-500">Text content</div>
            </button>
            <button
              onClick={() => handleAddBlock("image")}
              className="w-full text-left px-4 py-2 hover:bg-purple-50 border-b"
            >
              <div className="font-medium">Image</div>
              <div className="text-xs text-gray-500">URL or file</div>
            </button>
            <button
              onClick={() => handleAddBlock("video")}
              className="w-full text-left px-4 py-2 hover:bg-pink-50 border-b"
            >
              <div className="font-medium">Video</div>
              <div className="text-xs text-gray-500">YouTube/Vimeo</div>
            </button>
            <button
              onClick={() => handleAddBlock("shortcode")}
              className="w-full text-left px-4 py-2 hover:bg-yellow-50"
            >
              <div className="font-medium">Shortcode</div>
              <div className="text-xs text-gray-500">[contact_form], [cta]</div>
            </button>
          </div>
        )}
      </div>

      {/* Debug Info */}
      <details className="text-xs text-gray-500 border-t pt-2">
        <summary className="cursor-pointer">View JSON (Debug)</summary>
        <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
          {stringifyContentBlocks(blocks)}
        </pre>
      </details>
    </div>
  );
}
