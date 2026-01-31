# WordPress-Like Block-Based Content Editor - Implementation Guide

## Overview

A structured, SEO-friendly content editor for CMS pages using block-based architecture (similar to WordPress Gutenberg). This replaces plain textarea with a visual, reorderable block system.

## Features Implemented

### 1. **Content Block Types**

#### Heading Block
- **Purpose**: SEO-friendly heading structure (H1-H4)
- **Fields**: 
  - `level`: H1 | H2 | H3 | H4
  - `text`: Heading text
- **Rendered as**: `<h1>` through `<h4>` with appropriate CSS classes
- **SEO Value**: Proper heading hierarchy for search engines

#### Paragraph Block
- **Purpose**: Long-form text content
- **Fields**:
  - `text`: Multi-line paragraph text (preserves line breaks)
- **Rendered as**: `<p>` with whitespace preservation
- **Use Case**: Main body content

#### Image Block
- **Purpose**: Embedded images with accessibility
- **Fields**:
  - `url` (required): Image URL (HTTP/HTTPS)
  - `alt` (optional): Alternative text for accessibility
  - `caption` (optional): Image caption
- **Rendered as**: `<figure>` with `<img>` and optional `<figcaption>`
- **Features**: 
  - Live preview in editor
  - Responsive sizing
  - Lazy loading

#### Video Block
- **Purpose**: Embedded videos from YouTube/Vimeo
- **Fields**:
  - `url` (required): YouTube or Vimeo URL
  - `caption` (optional): Video caption
- **Rendered as**: Responsive `<iframe>` with 16:9 aspect ratio
- **Supported**: 
  - YouTube: `youtube.com/watch?v=ID` or `youtu.be/ID`
  - Vimeo: `vimeo.com/ID`
- **Features**: Automatic embed URL extraction

#### Shortcode Block
- **Purpose**: Extensible system for future dynamic content
- **Fields**:
  - `value`: Shortcode syntax (e.g., `[contact_form]`, `[cta]`)
- **Rendered as**: Placeholder `<div>` with shortcode text
- **Future**: Can be extended to execute shortcodes server-side

### 2. **Content Data Structure**

```typescript
// JSON format stored in database
[
  { "type": "heading", "level": "h2", "text": "Introduction" },
  { "type": "paragraph", "text": "This is the main content..." },
  { "type": "image", "url": "https://...", "alt": "image alt" },
  { "type": "video", "url": "https://youtube.com/watch?v=dQw4w9WgXcQ" },
  { "type": "shortcode", "value": "[contact_form]" }
]
```

**Storage**: 
- Database column: `pages.content` (TEXT field)
- Format: JSON string
- Backward compatible: Falls back to parsing plain text

## File Structure

### Frontend Components

```
client/src/components/content-editor/
├── block-editor.tsx              # Main editor with add/reorder/remove
├── heading-block.tsx             # Heading editor UI
├── paragraph-block.tsx           # Paragraph editor UI
├── image-block.tsx               # Image editor with preview
├── video-block.tsx               # Video editor
└── shortcode-block.tsx           # Shortcode editor

client/src/utils/
└── render-blocks.tsx             # Block rendering utilities

client/src/pages/admin/
└── page-edit.tsx                 # Updated to use BlockEditor
```

### Backend

```
shared/
└── content-blocks.ts             # Type definitions & validation

server/storage/
└── cms.ts                        # Updated Page interface & functions

server/utils/
└── migrate-content.ts            # Migration helper for legacy content
```

## Usage in Admin Panel

### Creating a Page with Blocks

1. Go to `/admin/cms/pages`
2. Click "New Page"
3. Enter **Title** and **Slug**
4. Click **"Add Block"** in Content section
5. Choose block type:
   - Heading
   - Paragraph
   - Image
   - Video
   - Shortcode
6. Fill block fields
7. Click **"Save Draft"** or **"Publish"**

### Editing Blocks

Each block has:
- **Move Up/Down**: Reorder blocks
- **Delete**: Remove block
- **Edit Fields**: Type-specific inputs
- **Preview**: Image blocks show preview

### Block Validation

- Heading: Text required
- Paragraph: Text required
- Image: URL must be valid
- Video: Must be YouTube or Vimeo URL
- Shortcode: Value required
- **Minimum**: At least 1 block required to save/publish

## Public Page Rendering

### How Blocks are Rendered

**File**: `client/src/utils/render-blocks.tsx`

Each block type renders as:

```tsx
// Heading Block → <h1>-<h4>
<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-5">
  Introduction
</h2>

// Paragraph Block → <p>
<p className="text-gray-800 text-lg leading-relaxed mb-6 whitespace-pre-wrap">
  Content...
</p>

// Image Block → <figure>
<figure>
  <img src="..." alt="..." className="w-full rounded-lg shadow-md" />
  <figcaption>Caption...</figcaption>
</figure>

// Video Block → <iframe>
<div style={{ paddingBottom: "56.25%" }}>
  <iframe 
    src="https://www.youtube.com/embed/VIDEO_ID"
    allowFullScreen
  />
</div>

// Shortcode Block → <div> (placeholder)
<div className="bg-amber-50 border border-amber-300 rounded p-4">
  [contact_form]
  <p>Shortcode rendering coming soon</p>
</div>
```

### Example Public Page Output

URL: `/pages/example-page`

```html
<div className="min-h-screen flex flex-col bg-white">
  <Navbar />
  <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
    <!-- Breadcrumb -->
    <nav>Home / Category / Page Title</nav>
    
    <!-- Heading Block -->
    <h2>Welcome to Our Page</h2>
    
    <!-- Paragraph Block -->
    <p>This is the introduction paragraph...</p>
    
    <!-- Image Block -->
    <figure>
      <img src="..." alt="..." />
      <figcaption>Image caption</figcaption>
    </figure>
    
    <!-- Video Block -->
    <div style="paddingBottom: 56.25%">
      <iframe src="..." />
    </div>
    
    <!-- Shortcode Block -->
    <div>
      [contact_form]
      Shortcode rendering coming soon
    </div>
    
    <!-- Related Links -->
    <a href="/search?category=...">More from Category</a>
    <a href="/search">Browse All Pages</a>
  </main>
  <Footer />
</div>
```

## Data Flow

### Saving a Page

```
Admin Editor (BlockEditor)
    ↓
Block array: ContentBlock[]
    ↓
JSON.stringify(blocks)
    ↓
POST /api/admin/pages
{
  title: "...",
  content: "[{type:heading,...},...]",
  status: "draft" | "published"
}
    ↓
Backend: createPage() or updatePage()
    ↓
Database: pages.content = JSON string
```

### Viewing a Page

```
GET /pages/:slug
    ↓
PageView component
    ↓
parseContentBlocks(page.content)
    ↓
ContentBlock[] array
    ↓
renderBlocks(blocks)
    ↓
React JSX → HTML
```

## Type System

### Shared Types (shared/content-blocks.ts)

```typescript
// Block definitions
export interface HeadingBlock { type: "heading", level: "h1"|"h2"|"h3"|"h4", text: string }
export interface ParagraphBlock { type: "paragraph", text: string }
export interface ImageBlock { type: "image", url: string, alt?: string, caption?: string }
export interface VideoBlock { type: "video", url: string, caption?: string }
export interface ShortcodeBlock { type: "shortcode", value: string }

export type ContentBlock = HeadingBlock | ParagraphBlock | ImageBlock | VideoBlock | ShortcodeBlock

// Zod validation schemas
export const contentBlockSchema = z.union([...])
export const contentBlocksSchema = z.array(contentBlockSchema).min(1)

// Type guards
export function isHeadingBlock(block): block is HeadingBlock { ... }

// Utilities
export function parseContentBlocks(content: string | ContentBlock[]): ContentBlock[]
export function stringifyContentBlocks(blocks: ContentBlock[]): string
```

## Backward Compatibility

### Existing Content

Pages with old plain-text or HTML content will:
1. Be parsed on read into a single paragraph block
2. Maintain functionality for public viewing
3. Can be edited using new block editor (which converts to proper format)

### Migration Script

**File**: `server/utils/migrate-content.ts`

```typescript
import { migrateContentToBlocks } from "./server/utils/migrate-content";

// Run once to convert all legacy content
for (const page of pages) {
  const newContent = migrateContentToBlocks(page.content);
  await db.update(page.id, { content: newContent });
}
```

## Validation Rules

### Admin Editor

- At least **1 block** required
- Each block must pass type-specific validation:
  - Heading text required
  - Paragraph text required
  - Image URL must be valid
  - Video URL must be YouTube or Vimeo
  - Shortcode value required

### Publishing Validation

In addition to block validation:
- Title required
- Slug required (must be unique)
- Category required
- At least 1 tag required
- At least 1 block required

## Database Schema

**Existing column used**: `pages.content` (TEXT)

**No schema changes required**. The `content` field now stores JSON instead of HTML/plain text.

```sql
-- Existing schema (no changes needed)
CREATE TABLE pages (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID NOT NULL,
  content TEXT NOT NULL,  -- ← Now stores JSON
  status VARCHAR(50) NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Future Enhancements

1. **Shortcode Execution**: Parse and execute shortcodes server-side
2. **Rich Text Editor**: TipTap/Slate for paragraph blocks
3. **Template System**: Reusable block templates
4. **Block Presets**: Save favorite block configurations
5. **Version History**: Track block changes over time
6. **Image Upload**: Direct file upload instead of URL
7. **Custom Blocks**: Allow extending with domain-specific blocks
8. **Block Search**: Full-text search across block content

## Testing Checklist

### Admin Editor
- [ ] Create page with all block types
- [ ] Edit page and modify blocks
- [ ] Reorder blocks (move up/down)
- [ ] Delete blocks
- [ ] Add multiple blocks of same type
- [ ] Save as draft
- [ ] Publish page
- [ ] View in preview
- [ ] Edit published page

### Public Page Display
- [ ] Headings render at correct levels
- [ ] Paragraphs display with proper spacing
- [ ] Images show with alt text and captions
- [ ] Videos embed correctly and are responsive
- [ ] Shortcodes show as placeholders
- [ ] SEO metadata appears in page head
- [ ] Breadcrumbs display correctly
- [ ] Category/tag links work

### Backward Compatibility
- [ ] Existing pages still load
- [ ] Old plain-text content renders as single paragraph
- [ ] Editing old page converts to blocks
- [ ] Old pages can be published

## Example Page Content (JSON)

```json
[
  {
    "type": "heading",
    "level": "h2",
    "text": "Welcome to Our Service"
  },
  {
    "type": "paragraph",
    "text": "We provide professional detective services across multiple locations. Our experienced team is dedicated to delivering results with integrity and confidentiality."
  },
  {
    "type": "image",
    "url": "https://example.com/detective-team.jpg",
    "alt": "Professional detective team",
    "caption": "Our experienced team members"
  },
  {
    "type": "heading",
    "level": "h3",
    "text": "Why Choose Us?"
  },
  {
    "type": "paragraph",
    "text": "With over 20 years of experience, we understand the complexities of investigation work. We use modern techniques combined with proven investigative methods."
  },
  {
    "type": "video",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "caption": "Watch our service overview video"
  },
  {
    "type": "heading",
    "level": "h3",
    "text": "Get Started"
  },
  {
    "type": "shortcode",
    "value": "[contact_form]"
  }
]
```

## Implementation Complete ✅

- ✅ Block types defined
- ✅ Admin editor UI built
- ✅ Public renderer created
- ✅ Storage layer updated
- ✅ Type validation added
- ✅ Backward compatibility supported
- ✅ Migration utilities provided
