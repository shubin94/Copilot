import React from "react";
import { VideoBlock } from "@/shared/content-blocks";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

interface VideoBlockEditorProps {
  block: VideoBlock;
  index: number;
  onChange: (updatedBlock: VideoBlock) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function VideoBlockEditor({
  block,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: VideoBlockEditorProps) {
  return (
    <div className="border rounded-lg p-4 bg-pink-50">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700">
          Video Block {index + 1}
        </label>
        <div className="flex gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1 hover:bg-pink-200 disabled:opacity-50 rounded"
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1 hover:bg-pink-200 disabled:opacity-50 rounded"
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
          <label className="block text-sm font-medium mb-1">Video URL</label>
          <input
            type="url"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports YouTube and Vimeo URLs
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Caption (Optional)</label>
          <input
            type="text"
            value={block.caption || ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="Video caption..."
          />
        </div>
      </div>
    </div>
  );
}
