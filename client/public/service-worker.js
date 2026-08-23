const CACHE_NAME = "basera-cache-v2";
const TILE_CACHE_NAME = "basera-osm-tiles-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];
const TILE_HOSTS = new Set(["a.tile.openstreetmap.org", "b.tile.openstreetmap.org", "c.tile.openstreetmap.org", "tile.openstreetmap.org"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME, TILE_CACHE_NAME].includes(key)).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (TILE_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() || {};
  const title = payload.title || "Basera Update";
  const options = {
    body: payload.body || "You have a new rent, booking, or escrow update.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: payload.url || "/dashboard/student/payments" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(targetUrl));
});
