/* Only the app shell and immutable local assets are cached. Private API payloads,
   uploads, published pages and forms never enter the service-worker cache. */
const CACHE = "jotstead-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/",
          "/manifest.webmanifest",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
          "/icons/favicon-32.png",
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k.startsWith("jotstead-"))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const r = event.request,
    url = new URL(r.url);
  if (
    r.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/p/") ||
    url.pathname.startsWith("/f/")
  )
    return;
  if (r.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(r)
        .then((response) => {
          if (response.ok)
            caches
              .open(CACHE)
              .then((cache) => cache.put("/", response.clone()));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(r).then(
        (cached) =>
          cached ||
          fetch(r).then((response) => {
            if (response.ok)
              caches
                .open(CACHE)
                .then((cache) => cache.put(r, response.clone()));
            return response;
          }),
      ),
    );
  }
});
