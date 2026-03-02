const CACHE_NAME = "gymmer-v11";
const ASSETS = ["index.html", "styles.css", "app.js", "manifest.json", "icon.svg"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      var base = new URL(self.registration.scope);
      var urls = ASSETS.map(function (p) { return new URL(p, base).href; });
      return cache.addAll(urls);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request);
    })
  );
});
