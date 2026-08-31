const CACHE_NAME = 'futaba-pkis-v3';
const DOCS_CACHE_NAME = `${CACHE_NAME}-documents`;
const CURRENT_CACHES = [CACHE_NAME, DOCS_CACHE_NAME];

const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon.svg',
  '/apple-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/pkis-logo-wordmark(final).png',
];

// Install event: Pre-cache core shell & offline fallback
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('Failed to pre-cache some assets during SW install:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: Clean up old caches (including obsolete document caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !CURRENT_CACHES.includes(name))
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Push event: tampilkan notifikasi Andon
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Panggilan Andon', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Panggilan Andon';
  const options = {
    body: payload.body || 'Operator memanggil leader',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.call_id ? `andon-${payload.call_id}` : 'andon-call',
    renotify: true,
    requireInteraction: true,
    data: payload,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Klik notifikasi: fokus/buka halaman Andon Settings
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = '/admin/andon-settings';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Fetch event: Apply custom PWA strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. SUPABASE STORAGE DOCUMENTS: Stale-While-Revalidate (Cache-first with background revalidation)
  // Allows the last opened document/SOP to remain viewable even if network is disconnected.
  const isSupabaseStorage =
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/storage/v1/object/');

  if (isSupabaseStorage && request.method === 'GET') {
    event.respondWith(
      caches.open(DOCS_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);

        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              (networkResponse.status === 200 || networkResponse.type === 'opaque')
            ) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((fetchError) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            throw fetchError;
          });

        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // 2. NETWORK-ONLY: Never cache Supabase non-storage requests (REST/Auth/Realtime), Next.js /api/* endpoints, or non-GET requests
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    request.method !== 'GET'
  ) {
    return; // Default browser network fetch
  }

  // 3. NETWORK-FIRST for page navigations (HTML)
  // Network-first with fallback to /offline page if disconnected
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlinePage = await caches.match('/offline');
          return offlinePage || Response.error();
        })
    );
    return;
  }

  // 4. CACHE-FIRST for static assets (_next/static, public images, icons, fonts)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf|css|js)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
    return;
  }
});
