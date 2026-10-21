/* Cache hors ligne : aucune requête vers un serveur tiers, aucune donnée envoyée. */
var CACHE = 'budget-public-v2';
var FICHIERS = ['./', './index.html', './calc.js', './manifest.webmanifest', './apple-touch-icon.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request).then(function (resp) {
      var copie = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
      return resp;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
