// Minimal network-only service worker for Samsung Internet PWA detection.
// It does not cache files or change the site's responses.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});
