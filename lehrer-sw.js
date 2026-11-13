// Minimal network-only service worker for Samsung Internet PWA detection.
// It does not cache files or change the site's responses.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  // GitHub Pages darf für HTML keine ältere Browser-Cache-Fassung wiederverwenden.
  // Andere Dateien/Endpunkte bleiben im üblichen Netzbetrieb.
  const appDocument=url.origin===self.location.origin &&
    (url.pathname.endsWith(".html")||url.pathname.endsWith("/"));
  event.respondWith(appDocument?fetch(request,{cache:"no-store"}):fetch(request));
});
