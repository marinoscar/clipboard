# Phase 02 - Core Clipboard: Text & Basic Files

## Overview

This phase implements the core clipboard functionality: pasting text via Ctrl+V/Cmd+V, uploading files via drag-and-drop or file picker, storing files in AWS S3, and displaying all clipboard items in a responsive list view. This is the most critical phase as clipboard interaction is the core feature.

## Goals

- Clipboard item data model with support for text, images, files, and media
- Global paste handler (Ctrl+V/Cmd+V) that captures text, images, and files
- Drag-and-drop file upload zone
- Manual file upload button
- S3 integration for file storage (files < 10MB via direct upload)
- Paginated item list view sorted newest-first
- Copy-to-clipboard for text items
- Signed download URLs for file items
- Soft-delete (status change, not permanent removal)
- Type detection from MIME types

## Prerequisites

- Phase 1 complete (auth, Prisma, Docker running)
- AWS S3 bucket created (`clipboard-app`)
- S3 credentials in `.env` (already configured)

## Database Schema

The schema is already defined in `prisma/schema.prisma` from Phase 1 (we added all models upfront). The relevant models for this phase:

### ClipboardItem
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | String (FK) | Owner user |
| type | String | `text`, `image`, `file`, `media` |
| content | String? | Text content (for text type only) |
| fileName | String? | Original filename |
| fileSize | Int? | File size in bytes |
| mimeType | String? | MIME type |
| storageKey | String? | S3 object key |
| thumbnailKey | String? | S3 key for thumbnail (images) |
| metadata | String? | JSON string for extra data (dimensions, duration, etc.) |
| status | String | `active`, `archived`, `deleted` (default: `active`) |
| isPublic | Boolean | Public sharing flag (default: `false`) |
| shareToken | String? | Unique share URL token |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Updated timestamp |

### SystemSettings
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | String (unique) | Setting key |
| value | String | JSON-encoded value |
| updatedAt | DateTime | Updated timestamp |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/clipboard` | JWT | Create text clipboard item |
| POST | `/api/clipboard/upload` | JWT | Upload file (multipart/form-data, < 10MB) |
| GET | `/api/clipboard` | JWT | List user's items (paginated, filterable by type/status) |
| GET | `/api/clipboard/:id` | JWT | Get single item by ID |
| PATCH | `/api/clipboard/:id` | JWT | Update item (content, status) |
| DELETE | `/api/clipboard/:id` | JWT | Soft-delete item (set status=deleted) |
| GET | `/api/clipboard/:id/download` | JWT | Get signed S3 download URL (redirect or JSON) |

### Query Parameters for GET /api/clipboard

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| pageSize | number | 50 | Items per page |
| type | string | - | Filter by type: text, image, file, media |
| status | string | active | Filter by status: active, archived, deleted |
| search | string | - | Search in content/fileName |
| sortBy | string | createdAt | Sort field |
| sortOrder | string | desc | Sort direction |

### POST /api/clipboard - Request Body
```json
{
  "type": "text",
  "content": "Hello world"
}
```

### POST /api/clipboard/upload - Multipart Form Data
- `file`: The uploaded file (required)
- `type`: Override type detection (optional)

### Response Format
All responses wrapped in `{ data, meta }` by TransformInterceptor.

```json
{
  "data": {
    "id": "uuid",
    "type": "text",
    "content": "Hello world",
    "fileName": null,
    "fileSize": null,
    "mimeType": "text/plain",
    "status": "active",
    "isPublic": false,
    "createdAt": "2026-03-15T...",
    "updatedAt": "2026-03-15T..."
  }
}
```

## Files to Create

### API Files

#### `src/storage/storage.module.ts`
Global module providing S3StorageProvider. Exports for use by ClipboardModule.

#### `src/storage/s3-storage.provider.ts`
AWS S3 operations adapted from Knecta's `apps/api/src/storage/providers/s3/s3-storage.provider.ts`:
- `upload(key, body, contentType)` - Upload buffer/stream to S3
- `getSignedDownloadUrl(key, expirySeconds)` - Generate presigned GET URL
- `delete(key)` - Delete S3 object
- `exists(key)` - Check if object exists

Dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

#### `src/clipboard/clipboard.module.ts`
Feature module importing StorageModule, providing ClipboardService, ClipboardController.

#### `src/clipboard/clipboard.controller.ts`
REST controller with endpoints listed above. Uses `@CurrentUser()` decorator, Zod validation.
- Text creation: parse JSON body
- File upload: use `@fastify/multipart` to handle file stream, determine type from MIME

#### `src/clipboard/clipboard.service.ts`
Business logic:
- `createTextItem(userId, content)` - Create text item in DB
- `createFileItem(userId, file, metadata)` - Upload to S3, create DB record
- `listItems(userId, query)` - Paginated query with filters
- `getItem(userId, itemId)` - Single item lookup (verify ownership)
- `updateItem(userId, itemId, data)` - Update content/status
- `deleteItem(userId, itemId)` - Set status=deleted
- `getDownloadUrl(userId, itemId)` - Generate signed URL

S3 key pattern: `clipboard/{userId}/{itemId}/{filename}`

Type detection logic:
```
text/*                    -> "text"
image/*                   -> "image"
audio/*, video/*          -> "media"
everything else           -> "file"
```

#### `src/clipboard/dto/create-item.dto.ts`
Zod schema:
```typescript
const CreateTextItemSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(1000000),
});
```

#### `src/clipboard/dto/update-item.dto.ts`
```typescript
const UpdateItemSchema = z.object({
  content: z.string().optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
});
```

#### `src/clipboard/dto/clipboard-query.dto.ts`
```typescript
const ClipboardQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  type: z.enum(['text', 'image', 'file', 'media']).optional(),
  status: z.enum(['active', 'archived', 'deleted']).default('active'),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'fileName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

### Web Files

#### `src/pages/ClipboardPage.tsx`
Main page replacing HomePage. Contains:
- `ClipboardInput` component at top
- `ClipboardItemList` component below
- Uses `useClipboard` hook for data
- Uses `useClipboardPaste` hook for global paste handling

#### `src/components/clipboard/ClipboardInput.tsx`
The primary interaction component:
- Large drop zone with dashed border
- Text: "Paste anything or drop files here"
- Upload button (file picker)
- Drag-and-drop overlay on dragenter
- Global `paste` event listener on document
- On paste: detect content type, call appropriate API
- On drop: upload files
- On file picker: upload selected files
- Show loading state during upload

#### `src/components/clipboard/ClipboardItemList.tsx`
Scrollable list of clipboard items:
- Infinite scroll or "Load More" button
- Each item rendered as `ClipboardItemCard`
- Empty state: "No items yet. Paste something!"
- Loading state: skeleton cards

#### `src/components/clipboard/ClipboardItemCard.tsx`
Card for each item type:
- **Text**: Show first 200 chars, "Copy" button, expand on click
- **Image**: Inline thumbnail (signed URL), click to expand, download button
- **File**: File icon + filename + formatted size, download button
- **Media**: Audio/video icon + filename + size, download button
- All types: timestamp, delete button, type badge
- Responsive: full-width on mobile, grid on desktop

#### `src/components/clipboard/TextItemView.tsx`
Full text view dialog/modal:
- Show complete text with word wrap
- Copy to clipboard button
- Edit capability (optional)

#### `src/components/clipboard/FileItemView.tsx`
File detail view:
- Filename, size, MIME type, upload date
- Download button (opens signed URL)
- For images: full-size preview
- For media: inline player (if browser supports)

#### `src/hooks/useClipboard.ts`
Data fetching hook:
```typescript
function useClipboard(query?: ClipboardQuery) {
  // State: items[], isLoading, error, hasMore
  // Methods: refresh(), loadMore(), deleteItem(id)
  // Fetch from /api/clipboard with pagination
}
```

#### `src/hooks/useClipboardPaste.ts`
Paste event handler hook:
```typescript
function useClipboardPaste(onItemCreated: (item) => void) {
  // Register global paste listener
  // Handle text: clipboardData.getData('text/plain')
  // Handle files: clipboardData.files
  // Handle images: clipboardData.items (type 'image/*')
  // Call API to create item
  // Call onItemCreated callback
}
```

#### `src/hooks/useFileUpload.ts`
File upload with progress:
```typescript
function useFileUpload() {
  // State: isUploading, progress (0-100), error
  // Methods: upload(file) -> ClipboardItem
  // Uses FormData + fetch with XMLHttpRequest for progress
}
```

#### Update `src/types/index.ts`
Add ClipboardItem type and related interfaces.

#### Update `src/services/api.ts`
Add clipboard API functions:
- `createTextItem(content)`
- `uploadFile(file)`
- `getClipboardItems(query)`
- `getClipboardItem(id)`
- `updateClipboardItem(id, data)`
- `deleteClipboardItem(id)`
- `getDownloadUrl(id)`

#### Update `src/App.tsx`
- Replace HomePage import with ClipboardPage
- Route `/` to `ClipboardPage`

### API Module Registration

Update `src/app.module.ts`:
- Import `StorageModule`
- Import `ClipboardModule`

## Environment Variables (additions)

| Variable | Default | Description |
|----------|---------|-------------|
| S3_BUCKET | (required) | S3 bucket name |
| S3_REGION | us-east-1 | S3 region |
| AWS_ACCESS_KEY_ID | (required) | AWS access key |
| AWS_SECRET_ACCESS_KEY | (required) | AWS secret key |
| MAX_FILE_SIZE | 10737418240 | Max file size (10GB) |
| SIGNED_URL_EXPIRY | 3600 | Signed URL expiry in seconds |

## Testing Checklist

- [ ] Ctrl+V with text in clipboard creates a text item
- [ ] Text item shows in list with preview and copy button
- [ ] Copy button copies text to clipboard
- [ ] Ctrl+V with screenshot/image creates an image item
- [ ] Image item shows inline thumbnail
- [ ] Drag-and-drop a file creates a file item
- [ ] Upload button opens file picker, selected file uploads
- [ ] File item shows name, size, download button
- [ ] Download button opens file in new tab / downloads
- [ ] Items sorted by newest first
- [ ] Delete button removes item from list (soft-delete)
- [ ] Pagination works (load more items)
- [ ] Filter by type works (text, image, file, media)
- [ ] Empty state shown when no items
- [ ] Loading spinners during upload and fetch
- [ ] Error handling for failed uploads
- [ ] Responsive layout: mobile (single column) vs desktop (grid)
- [ ] S3 objects created with correct key pattern
- [ ] API returns 403 when accessing another user's items

## Tests to Write

### API Tests
- `clipboard.service.spec.ts` - CRUD operations, ownership validation, S3 interaction mocks
- `clipboard.controller.spec.ts` - Endpoint routing, auth guards, file upload handling
- `s3-storage.provider.spec.ts` - S3 client mock, upload/download/delete operations

### Web Tests
- `useClipboard.test.ts` - Data fetching, pagination, delete
- `useClipboardPaste.test.ts` - Paste event handling for text, images, files
- `ClipboardItemCard.test.tsx` - Render different item types, actions
- `ClipboardInput.test.tsx` - Drop zone, paste handling, upload button

## Dependencies on Phase 1

- Auth module (JWT guard, @CurrentUser decorator)
- Prisma schema (ClipboardItem model already defined)
- API structure (app.module.ts, common filters/interceptors)
- Frontend structure (Layout, AuthContext, api service)

## What Phase 3 Builds On

- ClipboardService (adds WebSocket event emission after CRUD)
- S3StorageProvider (adds multipart upload methods)
- useClipboard hook (adds WebSocket listener for real-time updates)
- ClipboardItemCard (adds upload progress display)
