// sw.js - Production Service Worker v4
const CACHE_NAME = 'foundation-prod-v4';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './index.js',
  './styles/main.css',
  './core/config.js',
  './core/store.js',
  './core/validator.js',
  './core/theme.js',
  './core/logger.js',
  './core/navbar.js',
  './router/router.js',
  './components/global/ContentCard.js',
  './components/global/AuthorCard.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore non-http/https schemes (e.g. chrome-extension://) to prevent unsupported scheme errors
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Bypass API calls from Service Worker caching
  if (url.pathname.startsWith('/api/')) return;

  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If the network request fails with a non-ok status or a redirect loop (308, 404, etc), return cached index.html immediately
          if (!response || !response.ok || response.status === 308 || response.status === 404) {
            return caches.match('./index.html') || response;
          }
          return response;
        })
        .catch(async () => {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
          return new Response('Network error: SPA fallback unavailable offline.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/html' })
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        return new Response('Network error: Resource unavailable offline.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});