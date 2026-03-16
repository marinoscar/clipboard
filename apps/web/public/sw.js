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

  // Skip socket.io
  if (url.pathname.startsWith('/socket.io')) return;

  // Cache-first for app shell and assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const text = formData.get('text') || formData.get('url') || formData.get('title');
  const file = formData.get('file');

  const clients = await self.clients.matchAll({ type: 'window' });

  if (clients.length > 0) {
    clients[0].postMessage({
      type: 'share-target',
      text: text ? text.toString() : null,
      file: file instanceof File ? file : null,
    });
    clients[0].focus();
  }

  return Response.redirect('/?shared=true', 303);
}
