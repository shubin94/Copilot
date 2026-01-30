import React from "react";
import { ShortcodeBlock } from "@/shared/content-blocks";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

interface ShortcodeBlockEditorProps {
  block: ShortcodeBlock;
  index: number;
  onChange: (updatedBlock: ShortcodeBlock) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function ShortcodeBlockEditor({
  block,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: ShortcodeBlockEditorProps) {
  return (
    <div className="border rounded-lg p-4 bg-yellow-50">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700">
          Shortcode Block {index + 1}
        </label>
        <div className="flex gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1 hover:bg-yellow-200 disabled:opacity-50 rounded"
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1 hover:bg-yellow-200 disabled:opacity-50 rounded"
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
        <label className="block text-sm font-medium mb-1">Shortcode</label>
        <input
          type="text"
          value={block.value}
          onChange={(e) => onChange({ ...block, value: e.target.value })}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono text-sm"
          placeholder="e.g., [contact_form], [cta], [faq]"
        />
        <p className="text-xs text-gray-500 mt-2">
          Enter shortcode syntax. Currently rendered as placeholder. Future versions can add execution.
        </p>
      </div>
    </div>
  );
}
