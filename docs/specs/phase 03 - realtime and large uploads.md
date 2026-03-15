# Phase 03 - Real-time Sync & Large File Upload

## Overview

This phase adds real-time synchronization across devices using Socket.IO and support for large file uploads (multi-GB) via S3 multipart upload with browser-side progress tracking. When a user pastes or uploads on one device, the item appears instantly on all their other open devices.

## Goals

- Socket.IO WebSocket gateway with JWT authentication
- Per-user rooms for targeted event broadcasting
- Real-time item creation/update/deletion across all user devices
- S3 multipart upload for files > 10MB
- Browser-to-S3 direct upload via presigned URLs (bypasses API for large payloads)
- Upload progress tracking with visual progress bar
- Resume interrupted uploads
- Abort in-progress uploads

## Prerequisites

- Phase 2 complete (clipboard CRUD, S3 basic upload working)
- S3 bucket with CORS configured for browser direct uploads

### S3 CORS Configuration Required
The S3 bucket must allow browser direct uploads:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://clipboard.dev.marin.cr"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Database Schema

### UploadChunk (already in schema)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| itemId | String (FK) | ClipboardItem reference |
| partNumber | Int | S3 part number (1-based) |
| eTag | String | S3 ETag for the uploaded part |
| size | Int | Part size in bytes |
| uploadedAt | DateTime | Upload timestamp |

### ClipboardItem additions (already in schema)
| Column | Type | Description |
|--------|------|-------------|
| s3UploadId | String? | S3 multipart upload ID |
| uploadStatus | String? | `pending`, `uploading`, `complete`, `failed` |

## API Endpoints (additions)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/clipboard/upload/init` | JWT | Initialize multipart upload |
| GET | `/api/clipboard/upload/:id/url` | JWT | Get presigned URL for a part |
| POST | `/api/clipboard/upload/:id/complete` | JWT | Finalize multipart upload |
| POST | `/api/clipboard/upload/:id/abort` | JWT | Abort multipart upload |
| GET | `/api/clipboard/upload/:id/status` | JWT | Get upload progress (uploaded parts) |

### POST /api/clipboard/upload/init - Request
```json
{
  "fileName": "video.mp4",
  "fileSize": 524288000,
  "mimeType": "video/mp4"
}
```

### POST /api/clipboard/upload/init - Response
```json
{
  "data": {
    "itemId": "uuid",
    "uploadId": "s3-upload-id",
    "partSize": 10485760,
    "totalParts": 50,
    "storageKey": "clipboard/user-id/item-id/video.mp4"
  }
}
```

### GET /api/clipboard/upload/:id/url?partNumber=1 - Response
```json
{
  "data": {
    "url": "https://s3.amazonaws.com/...presigned-url...",
    "partNumber": 1
  }
}
```

### POST /api/clipboard/upload/:id/complete - Request
```json
{
  "parts": [
    { "partNumber": 1, "eTag": "\"abc123\"" },
    { "partNumber": 2, "eTag": "\"def456\"" }
  ]
}
```

## WebSocket Events

### Connection
Client connects with JWT token:
```typescript
const socket = io('/clipboard', {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

### Server -> Client Events
| Event | Payload | Description |
|-------|---------|-------------|
| `item:created` | `ClipboardItem` | New item added (from another device) |
| `item:updated` | `ClipboardItem` | Item updated |
| `item:deleted` | `{ id: string }` | Item deleted |

### Connection Management
- Server validates JWT on connection, rejects invalid tokens
- Each socket joins room `user:{userId}`
- On disconnect, socket leaves room automatically
- Client auto-reconnects with exponential backoff
- Heartbeat every 30s to detect stale connections

## Files to Create

### API Files

#### `src/gateway/events.module.ts`
Module providing EventsGateway. Imports AuthModule for JwtService.

#### `src/gateway/events.gateway.ts`
Socket.IO gateway:
```typescript
@WebSocketGateway({
  namespace: '/clipboard',
  cors: { origin: true, credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    // Extract JWT from client.handshake.auth.token
    // Validate with JwtService
    // Join room user:{userId}
    // Reject if invalid
  }

  handleDisconnect(client: Socket) {
    // Cleanup
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
```

#### `src/clipboard/clipboard-upload.controller.ts`
Multipart upload REST endpoints:
- `initUpload()` - Create item + S3 multipart, return presigned URL info
- `getPartUrl()` - Generate presigned PUT URL for specific part
- `completeUpload()` - Call S3 completeMultipartUpload, update item status
- `abortUpload()` - Call S3 abortMultipartUpload, cleanup
- `getUploadStatus()` - Return list of completed parts

#### `src/clipboard/clipboard-upload.service.ts`
Multipart upload orchestration:
- Coordinates between Prisma (UploadChunk records) and S3 provider
- Validates part ETags before completing
- Cleans up on abort (delete S3 parts + DB records)

#### Update `src/storage/s3-storage.provider.ts`
Add multipart methods:
- `initMultipartUpload(key, contentType)` - Returns uploadId
- `getSignedPartUrl(key, uploadId, partNumber)` - Returns presigned PUT URL
- `completeMultipartUpload(key, uploadId, parts)` - Finalize upload
- `abortMultipartUpload(key, uploadId)` - Cancel upload

#### Update `src/clipboard/clipboard.service.ts`
- Inject `EventsGateway`
- After `createTextItem()` → emit `item:created`
- After `createFileItem()` → emit `item:created`
- After `updateItem()` → emit `item:updated`
- After `deleteItem()` → emit `item:deleted`

#### Update `src/main.ts`
- Add Socket.IO adapter configuration if needed

#### Update `src/app.module.ts`
- Import `GatewayModule`

### Web Files

#### `src/contexts/SocketContext.tsx`
Socket.IO context provider:
```typescript
function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) return;
    const s = io('/clipboard', {
      auth: { token: api.getAccessToken() },
      transports: ['websocket'],
    });
    setSocket(s);
    return () => { s.disconnect(); };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
```

#### `src/hooks/useSocket.ts`
Socket event listener hook:
```typescript
function useSocket(event: string, handler: (data: any) => void) {
  const socket = useContext(SocketContext);
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [socket, event, handler]);
}
```

#### `src/hooks/useMultipartUpload.ts`
Large file upload hook:
```typescript
function useMultipartUpload() {
  // State: isUploading, progress (0-100), currentPart, totalParts, error
  // Methods: startUpload(file), abort()
  //
  // Flow:
  // 1. POST /clipboard/upload/init → get itemId, uploadId, totalParts
  // 2. For each part:
  //    a. GET /clipboard/upload/:id/url?partNumber=N → presigned URL
  //    b. PUT to presigned URL with file slice
  //    c. Track progress: (completedParts / totalParts) * 100
  // 3. POST /clipboard/upload/:id/complete with all ETags
  //
  // File slicing: file.slice(start, end) for each part
  // Progress: XMLHttpRequest with upload.onprogress for per-part progress
}
```

#### `src/components/clipboard/UploadProgress.tsx`
Visual upload progress:
- MUI LinearProgress with percentage label
- File name and size display
- Cancel button to abort upload
- Estimated time remaining (optional)

#### Update `src/hooks/useClipboard.ts`
- Add Socket.IO event listeners via `useSocket`:
  - `item:created` → prepend to items list
  - `item:updated` → update item in list
  - `item:deleted` → remove from list

#### Update `src/App.tsx`
- Wrap with `SocketProvider` (inside AuthProvider)

### Infrastructure

#### Update `infra/nginx/nginx.conf`
Socket.IO location block (already included in current config):
```nginx
location /socket.io/ {
    proxy_pass http://api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
}
```

## New Dependencies

### API
```json
"@nestjs/websockets": "^11.x",
"@nestjs/platform-socket.io": "^11.x",
"socket.io": "^4.x"
```

### Web
```json
"socket.io-client": "^4.x"
```

## Testing Checklist

- [ ] Open app on two browser tabs (same user)
- [ ] Paste text in tab 1 → appears in tab 2 within 1 second
- [ ] Upload file in tab 1 → appears in tab 2 when complete
- [ ] Delete item in tab 1 → disappears from tab 2
- [ ] Upload 100MB+ file → progress bar shows incremental progress
- [ ] Upload 1GB+ file → completes successfully with progress tracking
- [ ] Cancel upload mid-progress → upload aborts, cleanup occurs
- [ ] Kill network mid-upload → resume uploads remaining parts on reconnect
- [ ] WebSocket reconnects automatically after network interruption
- [ ] Invalid JWT on WebSocket → connection rejected
- [ ] Multiple users → events only go to the correct user's devices
- [ ] Socket.IO works through Nginx reverse proxy

## Tests to Write

### API Tests
- `events.gateway.spec.ts` - Connection auth, room management, event emission
- `clipboard-upload.service.spec.ts` - Init, part tracking, complete, abort flows
- `clipboard-upload.controller.spec.ts` - Endpoint routing, validation

### Web Tests
- `useSocket.test.ts` - Event subscription/unsubscription
- `useMultipartUpload.test.ts` - Upload flow, progress tracking, abort
- `UploadProgress.test.tsx` - Progress bar rendering, cancel button

## Dependencies on Phase 2

- ClipboardService (CRUD methods to emit events from)
- S3StorageProvider (extended with multipart methods)
- ClipboardItemCard (shows upload progress for in-progress items)
- useClipboard hook (augmented with real-time listeners)

## What Phase 4 Builds On

- WebSocket events (sharing toggle emits `item:updated`)
- ClipboardItem model (adds shareToken, isPublic usage)
