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
  const title = formData.get('title');
  const text = formData.get('text');
  const url = formData.get('url');
  const file = formData.get('file');

  const textContent = text || url || title || null;

  // Store in IndexedDB for the React app to pick up
  await savePendingShare({
    text: textContent ? textContent.toString() : null,
    file: file instanceof File ? file : null,
  });

  // Redirect to share-target page (app reads from IndexedDB)
  return Response.redirect('/share-target', 303);
}

function openShareDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('clipboard-share-target', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending-shares')) {
        db.createObjectStore('pending-shares', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePendingShare(data) {
  const db = await openShareDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-shares', 'readwrite');
    const store = tx.objectStore('pending-shares');
    store.add({
      text: data.text || null,
      file: data.file || null,
      fileName: data.file ? data.file.name : null,
      fileType: data.file ? data.file.type : null,
      timestamp: Date.now(),
    });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
