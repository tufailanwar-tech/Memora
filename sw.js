// memora offline support. installs once, then serves the app shell with no internet.
const CACHE = 'memora-v1';

// files needed to open the site. model weights live in webllm's own cache, not here.
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
];

self.addEventListener('install', (event) => {
  // save the shell on first install
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // drop caches from older versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // our files only — cdn libs and models handle their own caching
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      });
    })
  );
});
