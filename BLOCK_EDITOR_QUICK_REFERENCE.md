# Block Editor - Quick Reference

## Files Created/Modified

### Core Files
| File | Type | Purpose |
|------|------|---------|
| `shared/content-blocks.ts` | ✨ NEW | Block type definitions & validation |
| `client/src/components/content-editor/block-editor.tsx` | ✨ NEW | Main editor component |
| `client/src/components/content-editor/heading-block.tsx` | ✨ NEW | Heading block UI |
| `client/src/components/content-editor/paragraph-block.tsx` | ✨ NEW | Paragraph block UI |
| `client/src/components/content-editor/image-block.tsx` | ✨ NEW | Image block UI with preview |
| `client/src/components/content-editor/video-block.tsx` | ✨ NEW | Video block UI |
| `client/src/components/content-editor/shortcode-block.tsx` | ✨ NEW | Shortcode block UI |
| `client/src/utils/render-blocks.tsx` | ✨ NEW | Block rendering utilities |
| `server/storage/cms.ts` | 🔄 UPDATED | Page interface & JSON support |
| `client/src/pages/admin/page-edit.tsx` | 🔄 UPDATED | Replaced textarea with BlockEditor |
| `client/src/pages/page-view.tsx` | 🔄 UPDATED | Render blocks instead of HTML |
| `server/utils/migrate-content.ts` | ✨ NEW | Migration helper |

## Block Types Reference

### Heading Block
```typescript
{
  type: "heading",
  level: "h1" | "h2" | "h3" | "h4",
  text: string
}
```

### Paragraph Block
```typescript
{
  type: "paragraph",
  text: string
}
```

### Image Block
```typescript
{
  type: "image",
  url: string,           // Required: image URL
  alt?: string,          // Optional: alt text
  caption?: string       // Optional: image caption
}
```

### Video Block
```typescript
{
  type: "video",
  url: string,           // Required: YouTube or Vimeo URL
  caption?: string       // Optional: caption
}
```

### Shortcode Block
```typescript
{
  type: "shortcode",
  value: string          // Required: [shortcode_name] format
}
```

## Usage in Code

### Admin Editor Component

```tsx
import { BlockEditor } from "@/components/content-editor/block-editor";
import { ContentBlock, stringifyContentBlocks, parseContentBlocks } from "@/shared/content-blocks";

// In component state
const [blocks, setBlocks] = useState<ContentBlock[]>([]);

// Render editor
<BlockEditor
  blocks={blocks}
  onChange={(blocks) => setBlocks(blocks)}
/>

// Save to database
const content = stringifyContentBlocks(blocks);
await fetch("/api/admin/pages", {
  method: "POST",
  body: JSON.stringify({ content, ... })
});
```

### Public Page Renderer

```tsx
import { parseContentBlocks } from "@/shared/content-blocks";
import { renderBlocks } from "@/utils/render-blocks";

// Render blocks
const blocks = parseContentBlocks(page.content);
<div>{renderBlocks(blocks)}</div>
```

## Database Storage

**Column**: `pages.content`

**Before**: Plain text or HTML string
```
"This was plain text content"
```

**After**: JSON string
```json
[
  { "type": "paragraph", "text": "This was plain text content" }
]
```

## Admin Panel Flow

1. **Create Page**: `/admin/cms/pages` → "New Page"
2. **Enter Basic Info**: Title, Slug
3. **Add Content**: Click "+ Add Block" → Select type
4. **Fill Block Fields**: Type-specific inputs
5. **Reorder**: Use ↑/↓ buttons
6. **Remove**: Click trash icon
7. **Save**: "Save Draft" or "Publish"

## Public Page Display

**URL**: `/pages/:slug`

1. Fetch page from API
2. Parse `page.content` → `ContentBlock[]`
3. Render each block using `renderBlocks()`
4. Display with proper styling

## Validation

### Creating/Editing
- ✅ At least 1 block required
- ✅ Each block must be valid
- ✅ Heading/Paragraph text: non-empty
- ✅ Image URL: valid HTTP(S) URL
- ✅ Video URL: YouTube or Vimeo
- ✅ Shortcode: non-empty value

### Publishing (Additional)
- ✅ Title required
- ✅ Slug required
- ✅ Category required
- ✅ At least 1 tag required

## Backward Compatibility

Old content (plain text/HTML):
```
"Some old content"
```

Gets parsed as:
```json
[
  { "type": "paragraph", "text": "Some old content" }
]
```

When edited, it becomes proper block format.

## Common Tasks

### Create heading-paragraph combo
1. Add Heading block → Set level h2 → Enter title
2. Add Paragraph block → Enter text

### Add image with caption
1. Add Image block
2. Enter image URL
3. Enter alt text (for accessibility)
4. Enter caption text

### Embed video
1. Add Video block
2. Paste YouTube or Vimeo URL
3. Optional: Add caption

### Add contact form
1. Add Shortcode block
2. Enter: `[contact_form]`
3. Note: Shows as placeholder for now

## Styling

### Rendered Block CSS Classes

| Block | Element | Classes |
|-------|---------|---------|
| Heading H1 | `<h1>` | `text-4xl md:text-5xl font-bold text-gray-900 mb-6` |
| Heading H2 | `<h2>` | `text-3xl md:text-4xl font-bold text-gray-900 mb-5` |
| Paragraph | `<p>` | `text-gray-800 text-lg leading-relaxed mb-6` |
| Image | `<figure>` | `my-8`, `<img>`: `w-full rounded-lg shadow-md` |
| Video | `<div>` | Responsive 16:9 aspect ratio |
| Shortcode | `<div>` | `bg-amber-50 border border-amber-300` |

## Editor Colors

| Block Type | Background | Label |
|------------|-----------|-------|
| Heading | `bg-blue-50` | "Heading Block" |
| Paragraph | `bg-green-50` | "Paragraph Block" |
| Image | `bg-purple-50` | "Image Block" |
| Video | `bg-pink-50` | "Video Block" |
| Shortcode | `bg-yellow-50` | "Shortcode Block" |

## Performance

- Blocks are validated client-side before sending
- JSON is stored efficiently in database
- No external libraries needed
- Rendering is O(n) where n = number of blocks
- Images use lazy loading

## Future Enhancements

Priority 1:
- Shortcode execution
- Rich text in paragraphs

Priority 2:
- Image upload (not just URL)
- Block templates
- Version history

Priority 3:
- Custom blocks
- Block marketplace
- AI-powered content

## Troubleshooting

**Issue**: "At least one block is required"
- **Fix**: Add a block before saving

**Issue**: Image doesn't show in editor
- **Fix**: Check URL is valid and accessible

**Issue**: Video doesn't embed
- **Fix**: Ensure URL is YouTube or Vimeo

**Issue**: Old page content shows as single paragraph
- **Fix**: This is expected! Edit page to convert to blocks

## API Reference

### Saving blocks

```bash
curl -X PATCH http://localhost:5000/api/admin/pages/PAGE_ID \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "content": "[{\"type\":\"paragraph\",\"text\":\"Hello\"}]",
    "title": "Page Title",
    "status": "published"
  }'
```

### Fetching page

```bash
curl http://localhost:5000/api/public/pages/SLUG
# Returns: { page: { id, title, content: "[...]", blocks?: [...] } }
```

## Testing Examples

### Create test page with all blocks

1. Admin → New Page
2. Title: "Test Page"
3. Slug: "test-page"
4. Category: Any
5. Add blocks:
   - Heading (h2): "Introduction"
   - Paragraph: "This is a test paragraph..."
   - Image: `https://via.placeholder.com/600x400`
   - Video: `https://youtu.be/dQw4w9WgXcQ`
   - Shortcode: `[contact_form]`
6. Select tag
7. Publish
8. View at `/pages/test-page`

## Support

For questions or issues:
1. Check BLOCK_EDITOR_DOCUMENTATION.md
2. Review block type definitions in shared/content-blocks.ts
3. Check component props in individual block editors
4. View example JSON in documentation
