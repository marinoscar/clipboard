# S3 Upload Implementation Guide

A comprehensive guide to replicating the S3 upload system from the Clipboard app. Covers two upload paths: **Ctrl+V paste** and **button/drag-drop**, with support for small files (direct upload) and large files (presigned multipart upload).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [S3 & AWS Configuration](#s3--aws-configuration)
4. [Database Schema](#database-schema)
5. [Backend Implementation](#backend-implementation)
   - [S3 Storage Provider](#s3-storage-provider)
   - [Small File Upload Endpoint](#small-file-upload-endpoint)
   - [Multipart Upload Endpoints](#multipart-upload-endpoints)
6. [Frontend Implementation](#frontend-implementation)
   - [Ctrl+V Paste Upload](#ctrlv-paste-upload)
   - [Button / File Picker Upload](#button--file-picker-upload)
   - [Drag & Drop Upload](#drag--drop-upload)
   - [Small File Upload Hook](#small-file-upload-hook)
   - [Multipart Upload Hook](#multipart-upload-hook)
   - [Upload Progress Dialog](#upload-progress-dialog)
7. [API Reference](#api-reference)
8. [Key Design Decisions](#key-design-decisions)
9. [Common Gotchas](#common-gotchas)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React)                                                   │
│                                                                     │
│  Ctrl+V / Button / Drag-Drop                                       │
│        │                                                            │
│        ▼                                                            │
│  ┌──────────────┐    < 10MB?    ┌────────────────────┐              │
│  │ File received │──── YES ────▶│ useFileUpload hook  │              │
│  └──────┬───────┘              │ POST /upload (form) │              │
│         │                      └────────┬────────────┘              │
│         │ NO (≥ 10MB)                   │                           │
│         ▼                               │                           │
│  ┌──────────────────────┐               │                           │
│  │ useMultipartUpload   │               │                           │
│  │                      │               │                           │
│  │ 1. POST /upload/init │               │                           │
│  │ 2. GET  /upload/:id/url (×N)         │                           │
│  │ 3. PUT  → S3 presigned (×N) ──────────────────────┐              │
│  │ 4. POST /upload/:id/part (×N)        │            │              │
│  │ 5. POST /upload/:id/complete         │            │              │
│  └──────────────┬───────────────┘       │            │              │
│                 │                        │            │              │
└─────────────────┼────────────────────────┼────────────┼──────────────┘
                  │                        │            │
                  ▼                        ▼            ▼
┌─────────────────────────────────┐   ┌─────────────────────┐
│  BACKEND (NestJS API)           │   │  AWS S3              │
│                                 │   │                     │
│  - Creates DB record            │   │  - Stores the file  │
│  - Manages multipart lifecycle  │   │  - Returns ETags    │
│  - Generates presigned URLs     │   │  - Presigned URLs   │
│  - Emits Socket.IO events       │   │                     │
└─────────────────────────────────┘   └─────────────────────┘
```

**Key insight:** Small files go through the API server (buffer in memory). Large files go directly from the browser to S3 using presigned URLs — the API only orchestrates the process.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | NestJS + Fastify | API framework with multipart support |
| Frontend | React + TypeScript | UI with hooks for upload logic |
| S3 SDK | `@aws-sdk/client-s3` | S3 operations (PutObject, multipart) |
| Presigning | `@aws-sdk/s3-request-presigner` | Generate presigned URLs |
| ORM | Prisma (SQLite) | Track items and upload chunks |
| Real-time | Socket.IO | Notify other devices when upload completes |

**npm packages needed (backend):**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## S3 & AWS Configuration

### Environment Variables

```bash
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
SIGNED_URL_EXPIRY=3600          # Presigned URL TTL in seconds (default: 1 hour)
STORAGE_PART_SIZE=10485760      # Minimum part size in bytes (default: 10MB)
```

### S3 CORS Configuration (CRITICAL)

Your S3 bucket **must** have this CORS configuration, otherwise the browser cannot read the ETag header from S3 responses and multipart uploads will fail:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`ExposeHeaders: ["ETag"]` is the critical piece — without it, the browser's CORS policy hides the ETag header and the multipart flow breaks.

### NestJS Configuration Module

```typescript
// config/configuration.ts
export default () => ({
  storage: {
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY || '3600', 10),
    partSize: parseInt(process.env.STORAGE_PART_SIZE || '10485760', 10),
  },
});
```

---

## Database Schema

Two tables track uploads: the main item and per-part progress for multipart uploads.

```prisma
model ClipboardItem {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  type         String   // text, image, file, media
  content      String?  // For text-only items
  fileName     String?  @map("file_name")
  fileSize     BigInt?  @map("file_size")
  mimeType     String?  @map("mime_type")
  storageKey   String?  @map("storage_key")    // S3 object key
  s3UploadId   String?  @map("s3_upload_id")   // Multipart upload ID (null when complete)
  uploadStatus String?  @map("upload_status")  // uploading | complete | failed
  status       String   @default("active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  uploadChunks UploadChunk[]

  @@index([userId, status])
  @@map("clipboard_items")
}

model UploadChunk {
  id         String   @id @default(uuid())
  itemId     String   @map("item_id")
  partNumber Int      @map("part_number")
  eTag       String   @map("e_tag")
  size       Int
  uploadedAt DateTime @default(now()) @map("uploaded_at")

  item ClipboardItem @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId, partNumber])  // Enables idempotent upsert
  @@map("upload_chunks")
}
```

**Key fields:**
- `storageKey`: The S3 object path, e.g. `clipboard/{userId}/{itemId}/{fileName}`
- `s3UploadId`: The AWS multipart upload ID — set during init, cleared on complete/abort
- `uploadStatus`: Tracks lifecycle: `uploading` → `complete` or `failed`
- `UploadChunk`: One row per part, with `@@unique([itemId, partNumber])` enabling safe retries via upsert

---

## Backend Implementation

### S3 Storage Provider

This is the core S3 wrapper. It handles single uploads, multipart lifecycle, presigned URLs, and cleanup.

```typescript
// storage/s3-storage.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly defaultExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('storage.s3.region', 'us-east-1');
    const accessKeyId = this.configService.get<string>('storage.s3.accessKeyId', '');
    const secretAccessKey = this.configService.get<string>('storage.s3.secretAccessKey', '');

    this.bucket = this.configService.get<string>('storage.s3.bucket', '');
    this.defaultExpirySeconds = this.configService.get<number>('storage.signedUrlExpiry', 3600);

    this.s3Client = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined, // Falls back to instance role / env credentials
    });
  }

  // --- Single file upload (small files, buffered through API) ---

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  // --- Multipart upload lifecycle ---

  async initMultipartUpload(key: string, contentType: string): Promise<string> {
    const result = await this.s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );

    if (!result.UploadId) {
      throw new Error(`S3 did not return an UploadId for key: ${key}`);
    }

    return result.UploadId;
  }

  async getSignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: this.defaultExpirySeconds,
    });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<void> {
    await this.s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  // --- Download & utility ---

  async getSignedDownloadUrl(key: string, expirySeconds?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expirySeconds ?? this.defaultExpirySeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
```

---

### Small File Upload Endpoint

For files under the multipart threshold, the file is buffered through the API server and uploaded directly to S3.

**Controller:**
```typescript
// clipboard.controller.ts
@Post('upload')
async uploadFile(
  @Req() req: FastifyRequest,
  @CurrentUser() user: RequestUser,
) {
  // Fastify multipart: req.file() returns a single file from the form
  const file = await req.file();
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  const buffer = await file.toBuffer();

  return this.clipboardService.createFileItem(user.id, {
    buffer,
    filename: file.filename,
    mimetype: file.mimetype,
  });
}
```

**Service:**
```typescript
// clipboard.service.ts
async createFileItem(userId: string, file: { buffer: Buffer; filename: string; mimetype: string }) {
  const itemId = randomUUID();
  const s3Key = `clipboard/${userId}/${itemId}/${file.filename}`;

  // Upload to S3 first — fail fast before writing to DB
  await this.s3.upload(s3Key, file.buffer, file.mimetype);

  const item = await this.prisma.clipboardItem.create({
    data: {
      id: itemId,
      userId,
      type: this.detectType(file.mimetype),
      fileName: file.filename,
      fileSize: file.buffer.length,
      mimeType: file.mimetype,
      storageKey: s3Key,
      status: 'active',
      uploadStatus: 'complete',
    },
  });

  // Notify other devices via Socket.IO
  this.events.emitToUser(userId, 'item:created', item);
  return item;
}

private detectType(mimetype: string): string {
  if (mimetype.startsWith('text/')) return 'text';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) return 'media';
  return 'file';
}
```

**Fastify multipart config** (in `main.ts`):
```typescript
import multipart from '@fastify/multipart';

await app.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max for direct upload
  },
});
```

---

### Multipart Upload Endpoints

These five endpoints orchestrate the multipart upload lifecycle. They live in a separate controller.

**DTOs (Zod-based):**
```typescript
// dto/init-upload.dto.ts
export class InitUploadDto {
  @ApiProperty() fileName: string;
  @ApiProperty() fileSize: number;
  @ApiProperty() mimeType: string;
}

// dto/record-part.dto.ts
export class RecordPartDto {
  @ApiProperty() partNumber: number;
  @ApiProperty() eTag: string;
  @ApiProperty() size: number;
}

// dto/complete-upload.dto.ts
export class CompleteUploadDto {
  @ApiProperty({ type: [Object] })
  parts: { partNumber: number; eTag: string }[];
}

// dto/part-url-query.dto.ts
export class PartUrlQueryDto {
  @ApiProperty() partNumber: number;
}
```

**Controller:**
```typescript
// clipboard-upload.controller.ts
@Controller('clipboard/upload')
@ApiTags('Clipboard Upload')
export class ClipboardUploadController {
  constructor(private readonly uploadService: ClipboardUploadService) {}

  @Post('init')
  async initUpload(@Body() dto: InitUploadDto, @CurrentUser() user: RequestUser) {
    return this.uploadService.initUpload(user.id, dto);
  }

  @Get(':id/url')
  async getPartUrl(
    @Param('id') id: string,
    @Query() query: PartUrlQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.getPartUrl(user.id, id, query.partNumber);
  }

  @Post(':id/part')
  async recordPart(
    @Param('id') id: string,
    @Body() dto: RecordPartDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.completePart(user.id, id, dto.partNumber, dto.eTag, dto.size);
  }

  @Post(':id/complete')
  async completeUpload(
    @Param('id') id: string,
    @Body() dto: CompleteUploadDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.completeUpload(user.id, id, dto.parts);
  }

  @Post(':id/abort')
  @HttpCode(HttpStatus.OK)
  async abortUpload(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.uploadService.abortUpload(user.id, id);
  }
}
```

**Service:**
```typescript
// clipboard-upload.service.ts
@Injectable()
export class ClipboardUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageProvider,
    private readonly configService: ConfigService,
    private readonly events: EventsGateway,
  ) {}

  // --- Step 1: Initialize ---
  async initUpload(userId: string, dto: InitUploadDto) {
    // Dynamic part sizing: target ~100 parts, min 10MB, max 100MB
    const minPartSize = this.configService.get<number>('storage.partSize', 10 * 1024 * 1024);
    const maxPartSize = 100 * 1024 * 1024;
    const targetParts = 100;
    const partSize = Math.min(
      maxPartSize,
      Math.max(minPartSize, Math.ceil(dto.fileSize / targetParts)),
    );
    const totalParts = Math.ceil(dto.fileSize / partSize);

    const itemId = randomUUID();
    const s3Key = `clipboard/${userId}/${itemId}/${dto.fileName}`;

    const uploadId = await this.s3.initMultipartUpload(s3Key, dto.mimeType);

    await this.prisma.clipboardItem.create({
      data: {
        id: itemId,
        userId,
        type: this.detectType(dto.mimeType),
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        storageKey: s3Key,
        s3UploadId: uploadId,
        uploadStatus: 'uploading',
        status: 'active',
      },
    });

    return { itemId, uploadId, totalParts, partSize };
  }

  // --- Step 2: Presigned URL for each part ---
  async getPartUrl(userId: string, itemId: string, partNumber: number) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException('Upload is not in progress');
    }

    const url = await this.s3.getSignedPartUrl(
      item.storageKey!,
      item.s3UploadId!,
      partNumber,
    );

    return { url, partNumber };
  }

  // --- Step 3: Record each completed part ---
  async completePart(
    userId: string,
    itemId: string,
    partNumber: number,
    eTag: string,
    size: number,
  ) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException('Upload is not in progress');
    }

    // Upsert makes retries idempotent — if the same part is recorded
    // twice (e.g., network retry), it just updates the existing row.
    return this.prisma.uploadChunk.upsert({
      where: { itemId_partNumber: { itemId, partNumber } },
      create: { id: randomUUID(), itemId, partNumber, eTag, size },
      update: { eTag, size },
    });
  }

  // --- Step 4: Complete the multipart upload ---
  async completeUpload(
    userId: string,
    itemId: string,
    parts: { partNumber: number; eTag: string }[],
  ) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException('Upload is not in progress');
    }

    await this.s3.completeMultipartUpload(
      item.storageKey!,
      item.s3UploadId!,
      parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.eTag })),
    );

    const updated = await this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: { uploadStatus: 'complete', s3UploadId: null },
    });

    // Notify all connected devices
    this.events.emitToUser(userId, 'item:created', updated);
    return updated;
  }

  // --- Abort: cleanup on cancel or failure ---
  async abortUpload(userId: string, itemId: string) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException('Upload is not in progress');
    }

    await this.s3.abortMultipartUpload(item.storageKey!, item.s3UploadId!);
    await this.prisma.uploadChunk.deleteMany({ where: { itemId } });

    return this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: { uploadStatus: 'failed', s3UploadId: null },
    });
  }

  // --- Ownership check ---
  private async resolveOwnedItem(userId: string, itemId: string) {
    const item = await this.prisma.clipboardItem.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new NotFoundException(`Item ${itemId} not found`);
    if (item.userId !== userId) throw new ForbiddenException('Not your item');

    return item;
  }

  private detectType(mimetype: string): string {
    if (mimetype.startsWith('text/')) return 'text';
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) return 'media';
    return 'file';
  }
}
```

---

## Frontend Implementation

### Ctrl+V Paste Upload

This hook listens for the browser `paste` event globally and intercepts files/images from the clipboard.

```typescript
// hooks/useClipboardPaste.ts
import { useCallback, useEffect } from 'react';

export function useClipboardPaste(
  onFileReceived: (file: File) => void,
  onTextReceived: (text: string) => void,
) {
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      // Don't intercept paste inside form inputs or editable areas
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      // Priority 1: Check for files/images
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            onFileReceived(file);
          }
          return;
        }
      }

      // Priority 2: Check for plain text
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        onTextReceived(text);
      }
    },
    [onFileReceived, onTextReceived],
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);
}
```

**How it works:**
1. Registers a global `paste` event listener on `document`
2. Skips if the paste target is an `<input>`, `<textarea>`, or `contentEditable` element
3. Checks `e.clipboardData.items` for file entries first (screenshots, copied files)
4. Falls back to plain text if no files are found
5. Calls `e.preventDefault()` to stop the browser's default paste behavior

**Usage in a page component:**
```typescript
// pages/ClipboardPage.tsx
useClipboardPaste(
  (file) => handleFileForUpload(file),   // file from Ctrl+V
  (text) => handleCreateTextItem(text),   // text from Ctrl+V
);
```

---

### Button / File Picker Upload

A hidden `<input type="file">` is triggered by a visible button click.

```typescript
// components/clipboard/ClipboardActionBar.tsx
import { useRef, useCallback, ChangeEvent } from 'react';
import { Button } from '@mui/material';
import { CloudUpload, CameraAlt } from '@mui/icons-material';

export function ClipboardActionBar({
  onFileSelected,
}: {
  onFileSelected: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        onFileSelected(file);
      }
      // Reset so the same file can be re-selected
      if (e.target) e.target.value = '';
    },
    [onFileSelected],
  );

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"    // Opens rear camera on mobile
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Visible buttons */}
      <Button
        variant="outlined"
        startIcon={<CloudUpload />}
        onClick={() => fileInputRef.current?.click()}
      >
        Choose Files
      </Button>

      {/* Camera button — only visible on mobile */}
      <Button
        variant="outlined"
        startIcon={<CameraAlt />}
        onClick={() => cameraInputRef.current?.click()}
        sx={{ display: { xs: 'inline-flex', md: 'none' } }}
      >
        Camera
      </Button>
    </>
  );
}
```

**Key details:**
- `multiple` attribute allows selecting multiple files
- `accept="image/*" capture="environment"` opens the camera on mobile devices
- `e.target.value = ''` resets the input so the same file can be selected again

---

### Drag & Drop Upload

Two levels: a local drop zone component and a full-page drop overlay.

**Full-page drop hook:**
```typescript
// hooks/usePageDrop.ts
import { useState, useRef, useEffect } from 'react';

export function usePageDrop({
  onFilesDropped,
  enabled = true,
}: {
  onFilesDropped: (files: File[]) => void;
  enabled?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const counterRef = useRef(0);  // Track nested dragenter/dragleave
  const callbackRef = useRef(onFilesDropped);
  callbackRef.current = onFilesDropped;

  useEffect(() => {
    if (!enabled) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      counterRef.current++;
      if (counterRef.current === 1) setIsDragOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault(); // Required to allow drop
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      counterRef.current--;
      if (counterRef.current === 0) setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      counterRef.current = 0;
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) callbackRef.current(files);
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      counterRef.current = 0;
    };
  }, [enabled]);

  return { isDragOver };
}
```

**Why the counter?** When dragging over nested child elements, `dragenter` fires on each child. The counter tracks the real nesting depth so the drop overlay only shows/hides at the document boundary.

---

### Small File Upload Hook

For files under 10MB, a simple FormData POST through the API.

```typescript
// hooks/useFileUpload.ts
import { useState, useCallback } from 'react';

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Upload failed'));
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, isUploading, error };
}

// services/api.ts
export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/clipboard/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    body: formData,          // Don't set Content-Type — browser sets it with boundary
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Upload failed');
  }

  return response.json();
}
```

**Important:** Do NOT set `Content-Type` manually for FormData — the browser sets it automatically with the correct multipart boundary.

---

### Multipart Upload Hook

This is the core of the large file upload system. It orchestrates the entire multipart flow with concurrent uploads, per-part progress tracking, retry logic, and abort support.

```typescript
// hooks/useMultipartUpload.ts
import { useState, useCallback, useRef } from 'react';

const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const MAX_RETRIES = 3;
const CONCURRENCY = 3;  // Upload 3 parts simultaneously

export function isLargeFile(file: File): boolean {
  return file.size > MULTIPART_THRESHOLD;
}

// --- Helper: sleep for exponential backoff ---
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Helper: Upload a single part to S3 via XHR (for progress events) ---
function uploadPartToS3(
  url: string,
  data: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // ETag may be quoted — strip surrounding quotes
        const rawETag = xhr.getResponseHeader('ETag') || '';
        const eTag = rawETag.replace(/^"|"$/g, '');
        resolve(eTag);
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));

    // Allow external abort
    signal.addEventListener('abort', () => xhr.abort());

    xhr.open('PUT', url);
    xhr.send(data);
  });
}

// --- Helper: Upload with retry + exponential backoff ---
async function uploadPartToS3WithRetry(
  url: string,
  data: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }

    try {
      const eTag = await uploadPartToS3(url, data, signal, onProgress);
      if (!eTag) {
        throw new Error(
          'S3 did not return an ETag header. Check S3 CORS config: ExposeHeaders must include "ETag".',
        );
      }
      return eTag;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;

      lastError = err instanceof Error ? err : new Error('Upload failed');

      // Don't retry CORS/ETag issues — they won't resolve on retry
      if (lastError.message.includes('ETag')) throw lastError;

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < MAX_RETRIES - 1) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error('Upload failed after retries');
}

// --- Main hook ---
export function useMultipartUpload() {
  const [state, setState] = useState({
    isUploading: false,
    progress: 0,       // 0-100
    error: null as Error | null,
    currentFile: null as File | null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeItemIdRef = useRef<string | null>(null);

  const startUpload = useCallback(async (file: File) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({ isUploading: true, progress: 0, error: null, currentFile: file });

    try {
      // Step 1: Initialize multipart upload
      const { itemId, partSize, totalParts } = await initMultipartUpload({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      activeItemIdRef.current = itemId;

      // Per-part progress tracking (0.0 to 1.0 each)
      const partProgress = new Float64Array(totalParts);
      const completedParts: { partNumber: number; eTag: string }[] = [];

      const updateOverallProgress = () => {
        let total = 0;
        for (let i = 0; i < totalParts; i++) total += partProgress[i];
        const pct = Math.round((total / totalParts) * 100);
        setState((prev) => ({ ...prev, progress: pct }));
      };

      // Step 2: Upload parts with concurrent workers
      const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
      let cursor = 0;

      const uploadNextPart = async (): Promise<void> => {
        while (cursor < partNumbers.length) {
          if (controller.signal.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }

          const partNumber = partNumbers[cursor++];
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          // Get presigned URL from our API
          const { url } = await getPartUploadUrl(itemId, partNumber);

          // Upload directly to S3 with retry
          const eTag = await uploadPartToS3WithRetry(
            url,
            chunk,
            controller.signal,
            (loaded, total) => {
              partProgress[partNumber - 1] = loaded / total;
              updateOverallProgress();
            },
          );

          // Record completion with our API (idempotent via upsert)
          await recordUploadPart(itemId, { partNumber, eTag, size: chunk.size });

          completedParts.push({ partNumber, eTag });
          partProgress[partNumber - 1] = 1;
          updateOverallProgress();
        }
      };

      // Launch concurrent workers
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, totalParts) },
        () => uploadNextPart(),
      );
      await Promise.all(workers);

      // Sort parts (S3 requires ordered list)
      completedParts.sort((a, b) => a.partNumber - b.partNumber);

      // Step 3: Complete the upload
      const item = await completeMultipartUpload(itemId, completedParts);

      setState({ isUploading: false, progress: 100, error: null, currentFile: null });
      return item;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');

      // If aborted, clean up on the server
      if (
        err instanceof DOMException &&
        err.name === 'AbortError' &&
        activeItemIdRef.current
      ) {
        abortMultipartUpload(activeItemIdRef.current).catch(() => {});
      }

      setState({ isUploading: false, progress: 0, error, currentFile: null });
      throw error;
    }
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { ...state, startUpload, abort };
}
```

**API functions used by the hook:**
```typescript
// services/api.ts

export async function initMultipartUpload(data: {
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  const res = await fetchWithAuth('/api/clipboard/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json(); // { itemId, uploadId, totalParts, partSize }
}

export async function getPartUploadUrl(itemId: string, partNumber: number) {
  const res = await fetchWithAuth(
    `/api/clipboard/upload/${itemId}/url?partNumber=${partNumber}`,
  );
  return res.json(); // { url, partNumber }
}

export async function recordUploadPart(
  itemId: string,
  data: { partNumber: number; eTag: string; size: number },
) {
  const res = await fetchWithAuth(`/api/clipboard/upload/${itemId}/part`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function completeMultipartUpload(
  itemId: string,
  parts: { partNumber: number; eTag: string }[],
) {
  const res = await fetchWithAuth(`/api/clipboard/upload/${itemId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts }),
  });
  return res.json();
}

export async function abortMultipartUpload(itemId: string) {
  const res = await fetchWithAuth(`/api/clipboard/upload/${itemId}/abort`, {
    method: 'POST',
  });
  return res.json();
}
```

---

### Upload Progress Dialog

Shows upload status with a progress bar, file info, and cancel button.

```typescript
// components/clipboard/UploadProgressDialog.tsx
import { Dialog, DialogTitle, DialogContent, DialogActions,
         Button, LinearProgress, Typography, Box } from '@mui/material';

interface Props {
  open: boolean;
  fileName: string;
  fileSize: number;
  progress: number;   // 0-100 for multipart, -1 for indeterminate (small file)
  onCancel: () => void;
}

export function UploadProgressDialog({ open, fileName, fileSize, progress, onCancel }: Props) {
  const isIndeterminate = progress < 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>Uploading File</DialogTitle>
      <DialogContent>
        <Typography variant="body2" noWrap>{fileName}</Typography>
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(fileSize)}
        </Typography>
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant={isIndeterminate ? 'indeterminate' : 'determinate'}
            value={isIndeterminate ? undefined : progress}
          />
          {!isIndeterminate && (
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              {progress}%
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="error">Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
```

**Progress values:**
- `-1`: Indeterminate (small file upload, no granular progress)
- `0-100`: Determinate (multipart upload with per-part tracking)

---

### Tying It All Together (Page Component)

The page component routes files to the correct upload path based on size:

```typescript
// pages/ClipboardPage.tsx (relevant upload logic)
import { useFileUpload } from '../hooks/useFileUpload';
import { useMultipartUpload, isLargeFile } from '../hooks/useMultipartUpload';
import { useClipboardPaste } from '../hooks/useClipboardPaste';
import { usePageDrop } from '../hooks/usePageDrop';

export function ClipboardPage() {
  const { upload: simpleUpload, isUploading: isSimpleUploading } = useFileUpload();
  const {
    startUpload: multipartUpload,
    abort: abortMultipart,
    isUploading: isMultipartUploading,
    progress,
    currentFile,
  } = useMultipartUpload();

  // Unified file handler — routes to correct upload path
  const handleFileForUpload = useCallback(async (file: File) => {
    try {
      if (isLargeFile(file)) {
        const item = await multipartUpload(file);
        handleItemCreated(item);
      } else {
        const item = await simpleUpload(file);
        if (item) handleItemCreated(item);
      }
    } catch (err) {
      // Error already captured in hook state
    }
  }, [multipartUpload, simpleUpload]);

  // Register Ctrl+V handler
  useClipboardPaste(
    handleFileForUpload,                   // files from paste
    (text) => handleCreateTextItem(text),  // text from paste
  );

  // Register full-page drag & drop
  const { isDragOver } = usePageDrop({
    onFilesDropped: (files) => {
      for (const file of files) handleFileForUpload(file);
    },
  });

  const isUploading = isSimpleUploading || isMultipartUploading;

  return (
    <>
      {/* Action bar with Choose Files / Camera buttons */}
      <ClipboardActionBar onFileSelected={handleFileForUpload} />

      {/* Drag-and-drop zone in the input area */}
      <ClipboardInput onFileSelected={handleFileForUpload} />

      {/* Full-page drag overlay */}
      {isDragOver && <DropOverlay />}

      {/* Upload progress dialog */}
      <UploadProgressDialog
        open={isUploading}
        fileName={currentFile?.name || ''}
        fileSize={currentFile?.size || 0}
        progress={isMultipartUploading ? progress : -1}
        onCancel={() => {
          if (isMultipartUploading) abortMultipart();
        }}
      />
    </>
  );
}
```

---

## API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/clipboard/upload` | Upload small file via FormData (< 100MB) |
| `POST` | `/api/clipboard/upload/init` | Initialize multipart upload |
| `GET` | `/api/clipboard/upload/:id/url?partNumber=N` | Get presigned URL for part N |
| `POST` | `/api/clipboard/upload/:id/part` | Record completed part (ETag + size) |
| `POST` | `/api/clipboard/upload/:id/complete` | Finalize multipart upload |
| `POST` | `/api/clipboard/upload/:id/abort` | Cancel and cleanup multipart upload |
| `GET` | `/api/clipboard/upload/:id/status` | Check upload status and completed parts |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **10MB threshold** for multipart | Below 10MB, the overhead of multipart (init + URLs + complete) is worse than buffering through the API |
| **3 concurrent part uploads** | Balances throughput against browser connection limits (6 per origin) |
| **Dynamic part sizing** (10-100MB) | Targets ~100 parts max. A 5GB file gets 50MB parts (100 parts), not 10MB parts (500+ parts) |
| **XHR instead of fetch** for S3 PUT | `XMLHttpRequest.upload.onprogress` provides real-time upload progress. `fetch()` has no upload progress API |
| **Presigned URLs** | Files go directly from browser to S3 — never through the API server. Saves bandwidth and memory |
| **Upsert for part recording** | Network retries are safe: recording the same part twice just updates the existing row |
| **Upload to S3 before DB write** (small files) | Fail fast — if S3 is down, don't create an orphaned DB record |
| **AbortController** for cancellation | Single abort signal propagates to all in-flight XHR requests |
| **Float64Array for progress** | Efficient per-part tracking with minimal GC overhead |
| **ETag stripping of quotes** | S3 returns ETags wrapped in quotes (`"abc123"`); some S3 operations need them without quotes |

---

## Common Gotchas

1. **S3 CORS `ExposeHeaders: ["ETag"]`** — Without this, the browser blocks JavaScript from reading the ETag header from S3 responses. Multipart uploads will fail with a cryptic error. This is the #1 issue when setting up.

2. **Don't set `Content-Type` on FormData requests** — The browser auto-sets `Content-Type: multipart/form-data; boundary=...`. Setting it manually breaks the boundary.

3. **Fastify requires `@fastify/multipart`** — Unlike Express which uses `multer`, Fastify needs its own multipart plugin registered on the app instance.

4. **S3 requires parts sorted by partNumber** — When calling `CompleteMultipartUploadCommand`, parts must be in ascending order by `PartNumber`.

5. **ETag quoting varies** — Some S3-compatible services return unquoted ETags, others quote them. The code strips quotes defensively: `rawETag.replace(/^"|"$/g, '')`.

6. **Minimum S3 part size is 5MB** — AWS S3 enforces a minimum part size of 5MB (except the last part). The code uses 10MB minimum to stay well above this limit.

7. **Presigned URL expiry** — Default is 1 hour. For very slow connections uploading multi-GB files, this may need to be increased. The URL is fetched per-part just before upload, so each part gets a fresh URL.

8. **AbortController signal and XHR** — The abort signal must be connected to `xhr.abort()` via an event listener. Simply checking `signal.aborted` isn't enough because uploads are in-flight.

9. **Browser connection limits** — Browsers allow ~6 concurrent connections per origin. With 3 concurrent S3 uploads + API calls, this is well within limits. Increasing concurrency beyond 4-5 may cause connection queuing.

10. **Socket.IO event after complete** — The `item:created` event is emitted only after the `completeUpload` DB write succeeds, ensuring other devices see the item only when it's fully available.
