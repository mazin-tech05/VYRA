// Offline cache for the VYRA CRM app shell (no contact data is cached here;
// that lives in IndexedDB on the device).
const CACHE = 'vyra-crm-v1';
const SHELL = ['./', './index.html', './app.css?v=1', './app.js?v=1', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', '../assets/brand-mark.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // network first so updates arrive, cache as the offline fallback
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then(m => m || caches.match('./index.html'))));
});
