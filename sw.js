const CACHE = "panggungrejo-hitung-suara-v1";
const CORE = ["./","./index.html","./styles.css","./app.js","./firebase-config.js","./manifest.webmanifest","./assets/icon.svg","./assets/icon-192.svg","./assets/icon-512.svg","./assets/kandidat-1.svg","./assets/kandidat-2.svg","./assets/kandidat-3.svg","./assets/kandidat-4.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => { const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return resp; }).catch(()=>caches.match("./index.html"))));
});
