import React from "react";
import { ParagraphBlock } from "@/shared/content-blocks";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

interface ParagraphBlockEditorProps {
  block: ParagraphBlock;
  index: number;
  onChange: (updatedBlock: ParagraphBlock) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function ParagraphBlockEditor({
  block,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: ParagraphBlockEditorProps) {
  return (
    <div className="border rounded-lg p-4 bg-green-50">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700">
          Paragraph Block {index + 1}
        </label>
        <div className="flex gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1 hover:bg-green-200 disabled:opacity-50 rounded"
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1 hover:bg-green-200 disabled:opacity-50 rounded"
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

      <div>
        <label className="block text-sm font-medium mb-1">Content</label>
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 font-sans"
          placeholder="Enter paragraph text..."
          rows={5}
        />
      </div>
    </div>
  );
}
