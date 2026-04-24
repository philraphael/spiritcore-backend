const SHELL_CACHE = "spiritkins-shell-v1";
const APP_SHELL = [
  "/app",
  "/app/manifest.json",
  "/app/sw.js",
  "/app/styles.css",
  "/app/spiritverse-games.css",
  "/app/app.js",
  "/app/spiritverse-games.js",
  "/app/reveal-animation.js",
  "/app/assets/pwa/icon-192x192.png",
  "/app/assets/pwa/icon-512x512.png",
  "/app/assets/pwa/splash-540x720.png",
  "/app/assets/pwa/splash-1280x720.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => (key === SHELL_CACHE ? Promise.resolve() : caches.delete(key)))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/app")) return;

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cacheKey = url.pathname;
    const cached = await cache.match(cacheKey, { ignoreSearch: true });

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse && networkResponse.ok && (event.request.destination === "document" || event.request.destination === "script" || event.request.destination === "style" || APP_SHELL.includes(cacheKey))) {
        cache.put(cacheKey, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    } catch (_) {
      if (cached) return cached;
      throw _;
    }
  })());
});
