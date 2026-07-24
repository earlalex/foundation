// sw.js - Zero-Build Caching Engine with SPA Offline Fallback
const CACHE_NAME = 'foundation-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/index.js',
  '/styles/main.css',
  '/core/store.js',
  '/core/validator.js',
  '/core/theme.js',
  '/router/router.js',
  '/components/global/ContentCard.js',
  '/pages/home/home.html',
  '/pages/404.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        if (isNavigation) {
          return caches.match('/index.html');
        }

        return new Response('Offline resource unavailable.', { status: 503 });
      })
  );
});