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

  // Bypass API calls from Service Worker caching
  if (url.pathname.startsWith('/api/')) return;

  const isNavigation = event.request.mode === 'navigate';

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

        if (isNavigation) {
          return caches.match('./index.html');
        }

        return new Response('Network error: Resource unavailable offline.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});