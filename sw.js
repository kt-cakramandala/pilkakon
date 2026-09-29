const CACHE_NAME = 'panggungrejo-utara-v2';
const CORE = [
  './', './index.html', './styles.css', './app.js', './firebase-config.js', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png', './assets/kandidat-1.png', './assets/kandidat-2.png',
  './assets/kandidat-3.png', './assets/kandidat-4.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
