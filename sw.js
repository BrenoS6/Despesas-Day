const CACHE_NAME = 'expense-ai-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        console.log('Some assets could not be cached');
      });
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições para APIs externas
  if (url.hostname !== 'localhost' && url.hostname !== self.location.hostname) {
    return;
  }

  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request).then(response => {
        // Clonar resposta para salvar em cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      }).catch(() => {
        // Retornar versão em cache se fetch falhar
        return caches.match(request);
      });
    })
  );
});

// Cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});