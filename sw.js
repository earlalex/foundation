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

  // Bypass SW for API routes & Google Auth/Identity script requests
  if (url.pathname.startsWith('/api/') ||
      url.hostname === 'apis.google.com' ||
      url.hostname === 'accounts.google.com' ||
      url.hostname.endsWith('.google.com')) {
    return;
  }

  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(
      (async () => {
        const cleanResponse = async (res) => {
          if (!res || !res.redirected) return res;
          try {
            const blob = await res.blob();
            return new Response(blob, {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers
            });
          } catch (err) {
            return res;
          }
        };
        try {
          const cached = await caches.match('./index.html') || await caches.match('/index.html') || await caches.match('index.html');
          if (cached) {
            return await cleanResponse(cached);
          }
          return await fetch(event.request);
        } catch (error) {
          return new Response('Network error: SPA fallback unavailable offline.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/html' })
          });
        }
      })()
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

// Safeguard Service Worker message listeners and port safety
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Invoke port message channel response synchronously to prevent channel closures
  if (event.ports && event.ports[0]) {
    try {
      if (event.data.type === 'PING') {
        event.ports[0].postMessage({ type: 'PONG', status: 'success' });
      } else {
        // Acknowledge other message types synchronously
        event.ports[0].postMessage({ type: 'ACK', status: 'received' });
      }
    } catch (err) {
      console.warn('[ServiceWorker]: Message port response failed:', err);
    }
  }
});