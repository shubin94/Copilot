import React from "react";
import { ImageBlock } from "@/shared/content-blocks";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { imageFileToDataUrl } from "@/utils/image-upload";

interface ImageBlockEditorProps {
  block: ImageBlock;
  index: number;
  onChange: (updatedBlock: ImageBlock) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function ImageBlockEditor({
  block,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: ImageBlockEditorProps) {
  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await imageFileToDataUrl(file, { maxWidth: 2000, maxHeight: 2000, quality: 0.82 });
      onChange({ ...block, url: dataUrl });
    } catch (error) {
      console.error("Image upload failed", error);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-purple-50">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700">
          Image Block {index + 1}
        </label>
        <div className="flex gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1 hover:bg-purple-200 disabled:opacity-50 rounded"
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1 hover:bg-purple-200 disabled:opacity-50 rounded"
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
          <label className="block text-sm font-medium mb-1">Upload Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void handleFileChange(e.target.files?.[0])}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Alt Text</label>
          <input
            type="text"
            value={block.alt || ""}
            onChange={(e) => onChange({ ...block, alt: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Describe the image for accessibility..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Caption (Optional)</label>
          <input
            type="text"
            value={block.caption || ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Image caption..."
          />
        </div>

        {block.url && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Preview</label>
            <div className="bg-white border rounded p-2">
              <img
                src={block.url}
                alt={block.alt || ""}
                className="max-w-full h-auto max-h-64 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...block, url: "" })}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Remove image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
