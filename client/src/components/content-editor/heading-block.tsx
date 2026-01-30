import React from "react";
import { ContentBlock, HeadingBlock } from "@/shared/content-blocks";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

interface HeadingBlockEditorProps {
  block: HeadingBlock;
  index: number;
  onChange: (updatedBlock: HeadingBlock) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function HeadingBlockEditor({
  block,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: HeadingBlockEditorProps) {
  return (
    <div className="border rounded-lg p-4 bg-blue-50">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700">
          Heading Block {index + 1}
        </label>
        <div className="flex gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1 hover:bg-blue-200 disabled:opacity-50 rounded"
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1 hover:bg-blue-200 disabled:opacity-50 rounded"
              title="Move down"
            >
              <ChevronDown size={16} />
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1 hover:bg-red-200 text-red-600 rounded"
            title="Remove block"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Heading Level</label>
          <select
            value={block.level}
            onChange={(e) =>
              onChange({
                ...block,
                level: e.target.value as "h1" | "h2" | "h3" | "h4",
              })
            }
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="h1">H1 - Main Heading</option>
            <option value="h2">H2 - Subheading</option>
            <option value="h3">H3 - Minor Heading</option>
            <option value="h4">H4 - Small Heading</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Text</label>
          <input
            type="text"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter heading text..."
          />
        </div>
      </div>
    </div>
  );
}
