# Phase 04 - Public Sharing & Retention Policies

## Overview

This phase adds the ability to make clipboard items publicly accessible via unique share links (no authentication required to view), and implements system-level retention policies with automated cron jobs to archive and permanently delete old items.

## Goals

- Toggle any item between private and public
- Generate unique share tokens for public items
- Public view page for shared items (no auth required)
- Admin-only system settings page
- Configurable retention policies (archive-after and delete-after periods)
- Hourly cron job to archive expired items
- Hourly cron job to permanently delete archived items (including S3 cleanup)
- Admin guard for settings endpoints

## Prerequisites

- Phase 3 complete (real-time sync, multipart upload)
- Admin user exists (first user auto-assigned admin in Phase 1)

## API Endpoints

### Sharing Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/clipboard/:id/share` | JWT | Make item public, generate share token |
| DELETE | `/api/clipboard/:id/share` | JWT | Revoke public sharing |
| GET | `/api/share/:shareToken` | Public | Get public item by share token |
| GET | `/api/share/:shareToken/download` | Public | Download public file |

### Settings Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings/system` | JWT (admin) | Get all system settings |
| PATCH | `/api/settings/system` | JWT (admin) | Update system settings |

### POST /api/clipboard/:id/share - Response
```json
{
  "data": {
    "shareToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "shareUrl": "https://clipboard.dev.marin.cr/share/a1b2c3d4..."
  }
}
```

### GET /api/share/:shareToken - Response
```json
{
  "data": {
    "id": "item-uuid",
    "type": "text",
    "content": "Shared text content",
    "fileName": null,
    "mimeType": "text/plain",
    "createdAt": "2026-03-15T..."
  }
}
```
Note: Response excludes userId and sensitive fields. For file types, includes a signed download URL.

### PATCH /api/settings/system - Request
```json
{
  "retention.archiveAfterDays": 30,
  "retention.deleteAfterArchiveDays": 90
}
```

### System Settings Keys

| Key | Type | Values | Default | Description |
|-----|------|--------|---------|-------------|
| `retention.archiveAfterDays` | number\|null | null, 1, 7, 30, 90, 365 | null (never) | Days before active items are archived |
| `retention.deleteAfterArchiveDays` | number\|null | null, 1, 7, 30, 90, 365 | null (never) | Days before archived items are permanently deleted |

## Files to Create

### API Files

#### `src/clipboard/clipboard-share.controller.ts`
Sharing endpoints:
- `POST /:id/share` - Verify ownership, generate `crypto.randomBytes(16).toString('hex')`, set `isPublic=true` + `shareToken` on item, return share URL
- `DELETE /:id/share` - Verify ownership, set `isPublic=false`, clear `shareToken`
- `GET /share/:shareToken` - Public endpoint (no auth), lookup by shareToken, return item data. For files, include a time-limited signed download URL
- `GET /share/:shareToken/download` - Public endpoint, redirect to signed S3 URL

#### `src/clipboard/clipboard-share.service.ts`
Sharing business logic:
- `enableSharing(userId, itemId)` - Generate token, update item
- `disableSharing(userId, itemId)` - Clear token, set private
- `getPublicItem(shareToken)` - Lookup item, return safe subset of fields
- `getPublicDownloadUrl(shareToken)` - Generate signed URL for public file

#### `src/settings/settings.module.ts`
Feature module providing SettingsService, SettingsController.

#### `src/settings/settings.controller.ts`
Admin-only endpoints:
- `GET /settings/system` - Return all system settings as key-value map
- `PATCH /settings/system` - Update one or more settings (merge)

Uses `@UseGuards(AdminGuard)`.

#### `src/settings/settings.service.ts`
Settings business logic:
- `getAll()` - Fetch all from SystemSettings table, parse JSON values
- `get(key)` - Single setting
- `set(key, value)` - Upsert setting (JSON.stringify the value)
- `getRetentionConfig()` - Returns `{ archiveAfterDays, deleteAfterArchiveDays }`

Default values returned when no DB record exists.

#### `src/settings/dto/update-settings.dto.ts`
Zod schema validating the settings keys and allowed values.

#### `src/common/guards/admin.guard.ts`
```typescript
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
```

#### `src/retention/retention.module.ts`
Module providing RetentionService. Imports StorageModule for S3 cleanup.

#### `src/retention/retention.service.ts`
Cron job service:
```typescript
@Injectable()
export class RetentionService {
  @Cron(CronExpression.EVERY_HOUR)
  async archiveExpiredItems() {
    const config = await settingsService.getRetentionConfig();
    if (!config.archiveAfterDays) return; // null = never archive

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.archiveAfterDays);

    const result = await prisma.clipboardItem.updateMany({
      where: {
        status: 'active',
        createdAt: { lt: cutoff },
      },
      data: { status: 'archived' },
    });
    logger.log(`Archived ${result.count} items`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async deleteArchivedItems() {
    const config = await settingsService.getRetentionConfig();
    if (!config.deleteAfterArchiveDays) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.deleteAfterArchiveDays);

    // Find items to delete
    const items = await prisma.clipboardItem.findMany({
      where: {
        status: 'archived',
        updatedAt: { lt: cutoff },
      },
    });

    // Delete S3 objects
    for (const item of items) {
      if (item.storageKey) await s3Provider.delete(item.storageKey);
      if (item.thumbnailKey) await s3Provider.delete(item.thumbnailKey);
    }

    // Delete DB records
    await prisma.clipboardItem.deleteMany({
      where: { id: { in: items.map(i => i.id) } },
    });

    logger.log(`Permanently deleted ${items.length} items`);
  }
}
```

#### Update `src/app.module.ts`
- Import `SettingsModule`, `RetentionModule`

### Web Files

#### `src/components/clipboard/ShareDialog.tsx`
MUI Dialog for sharing:
- Toggle switch for public/private
- When public: show share URL with copy button
- Share URL format: `https://clipboard.dev.marin.cr/share/{shareToken}`
- Copy URL button with "Copied!" feedback
- Close button

#### `src/components/clipboard/ShareButton.tsx`
IconButton on each ClipboardItemCard:
- Share icon
- Opens ShareDialog
- Shows filled icon when item is public

#### `src/pages/PublicItemPage.tsx`
Public view (no Layout, no auth required):
- Minimal branded header ("Clipboard")
- Display item content based on type:
  - Text: rendered in a styled code/text block with copy button
  - Image: full-size display with download button
  - File: file info card with download button
  - Media: inline player with download button
- "Powered by Clipboard" footer
- 404 state if shareToken is invalid

#### `src/pages/SettingsPage.tsx`
Admin settings page:
- Only accessible by admin users
- Retention policy section with dropdowns
- Archive after: Never / 1 day / 7 days / 30 days / 90 days / 1 year
- Delete after archive: Never / 1 day / 7 days / 30 days / 90 days / 1 year
- Save button with confirmation

#### `src/components/settings/RetentionSettings.tsx`
Retention policy form:
- Two MUI Select dropdowns
- Helper text explaining the archive-then-delete flow
- Visual timeline showing: Active → Archived (after X days) → Deleted (after Y days)

#### Update `src/App.tsx`
- Add route `/share/:shareToken` (public, outside ProtectedRoute)
- Add route `/settings` (protected, inside Layout)

#### Update `src/components/clipboard/ClipboardItemCard.tsx`
- Add ShareButton to each card
- Show public indicator (icon/badge) when `isPublic` is true

#### Update `src/components/navigation/UserMenu.tsx`
- Settings link always visible for admin users (already there)

#### Update `src/services/api.ts`
Add functions:
- `enableSharing(itemId)` / `disableSharing(itemId)`
- `getPublicItem(shareToken)` / `getPublicDownloadUrl(shareToken)` (with `skipAuth: true`)
- `getSystemSettings()` / `updateSystemSettings(data)`

## Testing Checklist

- [ ] Click share icon on an item → ShareDialog opens
- [ ] Toggle public → share URL generated and displayed
- [ ] Copy URL button copies to clipboard
- [ ] Open share URL in incognito/private browser → item displayed without login
- [ ] Text items: full content shown with copy button
- [ ] Image items: image displayed with download button
- [ ] File items: file info shown with download button
- [ ] Toggle back to private → share URL returns 404
- [ ] Invalid share token → shows 404 page
- [ ] Admin user can access /settings page
- [ ] Non-admin user cannot access /settings page (redirect or 403)
- [ ] Retention settings save successfully
- [ ] Set "Archive after 1 day" → wait for cron (or trigger manually) → old items archived
- [ ] Archived items visible with status filter `?status=archived`
- [ ] Set "Delete after 1 day" → archived items permanently deleted
- [ ] S3 objects cleaned up on permanent deletion
- [ ] "Never" setting disables archival/deletion

## Tests to Write

### API Tests
- `clipboard-share.service.spec.ts` - Enable/disable sharing, public item lookup
- `settings.service.spec.ts` - CRUD system settings, defaults
- `retention.service.spec.ts` - Archive logic, delete logic, S3 cleanup, respects settings
- `admin.guard.spec.ts` - Allow admin, reject non-admin

### Web Tests
- `ShareDialog.test.tsx` - Toggle, URL display, copy
- `PublicItemPage.test.tsx` - Render different types, 404 state
- `RetentionSettings.test.tsx` - Dropdown selection, save

## Dependencies on Phase 3

- WebSocket events (sharing emits `item:updated`)
- ClipboardService (existing CRUD for ownership validation)
- S3StorageProvider (delete method for cleanup)

## What Phase 5 Builds On

- Share functionality (Web Share API uses share URLs)
- Public item page (referenced from PWA share target)
