// Service worker minimal - hanya diperlukan supaya Chrome mau menampilkan
// ikon custom saat "Add to Home Screen". Tidak melakukan caching apapun.
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
