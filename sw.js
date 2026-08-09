const CACHE_NAME = "gymmer-v94";
const ASSETS = ["index.html", "styles.css", "app.js", "firebase-app.js", "manifest.json", "icon.svg"];

function scopeBase() {
  return new URL(self.registration.scope);
}

function assetHref(path) {
  return new URL(path, scopeBase()).href;
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAllowlistedAsset(url) {
  if (!isSameOrigin(url)) return false;
  var base = scopeBase();
  for (var i = 0; i < ASSETS.length; i++) {
    var assetUrl = new URL(ASSETS[i], base);
    if (url.pathname === assetUrl.pathname) return true;
  }
  return false;
}

function isScopeNavigation(request, url) {
  if (request.mode !== "navigate" || !isSameOrigin(url)) return false;
  var scope = scopeBase();
  return url.href.indexOf(scope.href) === 0;
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      var urls = ASSETS.map(function (p) { return assetHref(p); });
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
  var request = e.request;
  if (request.method !== "GET") return;

  var url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  // Bypass SW for cross-origin and non-static requests (Firebase/auth/API, etc.).
  var cacheKey = null;
  if (isAllowlistedAsset(url)) {
    cacheKey = url.href;
  } else if (isScopeNavigation(request, url)) {
    cacheKey = assetHref("index.html");
  } else {
    return;
  }

  e.respondWith(
    caches.match(cacheKey).then(function (cached) {
      return cached || fetch(request);
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var client = windows[i];
        if (client && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("./");
      }
    })
  );
});
