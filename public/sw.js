/* SCANNER — minimal service worker (offline shell + static asset caching). */

const VERSION = "scanner-v2";
const PRECACHE = `${VERSION}-precache`;
const RUNTIME = `${VERSION}-runtime`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNextAsset = url.pathname.startsWith("/_next/");
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(
    self.location.hostname,
  );
  if (isLocalhost && isNextAsset) return;

  // Navigations: network first, fall back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then((cached) => cached || caches.match(request)),
        ),
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
