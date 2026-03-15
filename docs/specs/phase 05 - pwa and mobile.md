# Phase 05 - PWA, Mobile & Share Target

## Overview

This phase makes the application installable as a Progressive Web App (PWA) on mobile and desktop devices. It adds a service worker for offline shell caching, the Web App Manifest for installability, the Share Target API for receiving shared content from other Android apps (e.g., "Share to Clipboard"), and optimizes the responsive layout for mobile devices.

## Goals

- PWA manifest.json with app icons for installability
- Service worker for caching the app shell (HTML, JS, CSS)
- "Add to Home Screen" prompt on mobile browsers
- Standalone display mode (no browser chrome)
- Share Target API: Android "Share to" / "Send to" sends content to Clipboard
- Web Share API: share clipboard items from the app to other apps
- Mobile-optimized responsive layout (bottom nav, FAB, full-width cards)
- Touch-friendly interactions for paste and upload

## Prerequisites

- Phases 1-4 complete
- HTTPS required (PWA requires secure context — already configured via host Nginx)
- App icons in multiple sizes

## PWA Manifest

### `public/manifest.json`
```json
{
  "name": "Clipboard",
  "short_name": "Clipboard",
  "description": "Your universal clipboard across all devices",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "share_target": {
    "action": "/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "file",
          "accept": ["*/*"]
        }
      ]
    }
  }
}
```

### Key manifest properties:
- `display: "standalone"` - No browser chrome, looks like native app
- `share_target` - Registers the app as a share target on Android
- `share_target.method: "POST"` + `enctype: "multipart/form-data"` - Supports file sharing
- `share_target.params.files` - Accepts any file type

## Service Worker

### `public/sw.js`
Cache strategy:
- **App shell** (HTML, JS, CSS bundles): Cache on install, serve from cache (cache-first)
- **API calls** (`/api/*`): Always network (network-only), no caching
- **Static assets** (icons, fonts): Cache on first fetch (stale-while-revalidate)
- **Share target POST**: Intercept, extract form data, redirect to app with data in query/state

```javascript
const CACHE_NAME = 'clipboard-v1';
const SHELL_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Share target POST handler
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Skip API calls - always network
  if (url.pathname.startsWith('/api')) return;

  // Cache-first for app shell, stale-while-revalidate for assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const text = formData.get('text') || formData.get('url') || formData.get('title');
  const file = formData.get('file');

  // Store in a temporary location for the React app to pick up
  const clients = await self.clients.matchAll({ type: 'window' });

  if (clients.length > 0) {
    // Send to existing window
    clients[0].postMessage({
      type: 'share-target',
      text: text?.toString(),
      file: file,
    });
    clients[0].focus();
  }

  // Redirect to the app
  return Response.redirect('/?shared=true', 303);
}
```

## Files to Create/Modify

### Web Files

#### `public/manifest.json`
PWA manifest as specified above.

#### `public/sw.js`
Service worker as specified above.

#### `public/icons/`
App icons:
- `icon-192.png` (192x192) - Standard icon
- `icon-512.png` (512x512) - Standard icon
- `icon-maskable-192.png` (192x192) - Maskable icon (with safe zone padding)
- `icon-maskable-512.png` (512x512) - Maskable icon

Generate using a clipboard icon design. Can use a tool like https://maskable.app/ for maskable variants.

#### `src/pages/ShareTargetPage.tsx`
Handles incoming shares from Android:
```typescript
export default function ShareTargetPage() {
  // Listen for service worker postMessage with share-target data
  // If text: call API to create text item
  // If file: call API to upload file
  // Show success toast
  // Redirect to clipboard page

  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'share-target') {
        handleSharedContent(event.data);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);
}
```

#### `src/hooks/useWebShare.ts`
Web Share API hook for sharing FROM the app:
```typescript
function useWebShare() {
  const isSupported = !!navigator.share;

  async function share(data: { title?: string; text?: string; url?: string; files?: File[] }) {
    if (!navigator.share) throw new Error('Web Share not supported');
    await navigator.share(data);
  }

  return { isSupported, share };
}
```

#### `src/components/clipboard/ShareFromAppButton.tsx`
Button to share a clipboard item via the device's native share sheet:
- Uses Web Share API
- For text items: shares the text content
- For file items: shares the file URL
- For public items: shares the share URL
- Hidden on devices that don't support Web Share API

#### Update `index.html`
```html
<head>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1976d2" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Clipboard" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
</head>
```

Add service worker registration at end of body:
```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js');
    });
  }
</script>
```

#### Update `src/components/common/Layout.tsx`
Mobile-optimized layout:
- Desktop (md+): AppBar at top, content below
- Mobile (xs/sm): AppBar at top, bottom navigation bar
- Bottom nav items: Clipboard (home), Settings (admin only)
- Floating Action Button (FAB) for quick paste on mobile

```typescript
function Layout() {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box>
      <AppHeader />
      <Box component="main" sx={{ mb: isMobile ? '56px' : 0 }}>
        <Outlet />
      </Box>
      {isMobile && <BottomNavigation />}
    </Box>
  );
}
```

#### Update `src/components/clipboard/ClipboardInput.tsx`
Mobile-friendly enhancements:
- Larger touch targets
- FAB button for paste on mobile (in addition to drop zone)
- Swipe-to-delete on mobile (optional)
- Camera capture button on mobile devices

#### Update `src/components/clipboard/ClipboardItemCard.tsx`
- Full-width cards on mobile (xs: 12 grid)
- Grid layout on desktop (sm: 6, md: 4)
- Add "Share via..." button using Web Share API
- Swipe gestures for mobile (optional)

#### Update `src/App.tsx`
- Add `/share-target` route (protected, inside Layout)
- Import and use ShareTargetPage

## Testing Checklist

### PWA Installation
- [ ] Navigate to `https://clipboard.dev.marin.cr` on Android Chrome
- [ ] Chrome shows "Add to Home Screen" banner or menu option
- [ ] Install the app
- [ ] App icon appears on home screen
- [ ] Opening app shows standalone mode (no URL bar)
- [ ] `manifest.json` loads without errors (check DevTools > Application > Manifest)

### Service Worker
- [ ] Service worker registered (check DevTools > Application > Service Workers)
- [ ] App shell cached (check DevTools > Application > Cache Storage)
- [ ] Going offline: app shell loads, API calls show graceful error
- [ ] Coming back online: app resumes normal operation

### Share Target (Android)
- [ ] Open any app (e.g., Chrome, Notes, Gallery)
- [ ] Tap Share → "Clipboard" appears in share sheet
- [ ] Share text → text item created in Clipboard
- [ ] Share URL → text item created with URL content
- [ ] Share image → image uploaded and item created
- [ ] Share file → file uploaded and item created

### Web Share API
- [ ] Share button appears on items (on devices that support it)
- [ ] Tap share on text item → native share sheet with text content
- [ ] Tap share on public item → native share sheet with share URL

### Mobile Responsiveness
- [ ] Mobile: single-column card layout, full-width
- [ ] Mobile: bottom navigation bar visible
- [ ] Desktop: grid card layout
- [ ] Desktop: top AppBar only (no bottom nav)
- [ ] Paste input area accessible and usable on all screen sizes
- [ ] File upload button works on mobile (opens file picker / camera)

## Tests to Write

### Web Tests
- `useWebShare.test.ts` - Feature detection, share calls
- `ShareTargetPage.test.tsx` - Service worker message handling
- `Layout.test.tsx` - Mobile vs desktop rendering (bottom nav)

## Dependencies on Phase 4

- Share URLs (for Web Share API sharing)
- Public item page (share target redirects here)
- All CRUD functionality working

## What Phase 6 Builds On

- Complete feature set for production deployment
- Service worker needs cache busting strategy for production builds
