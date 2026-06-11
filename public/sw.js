const CACHE_NAME = "madridtvlive-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./pwa-icon.svg"
];

// 1. Install Event: Cache critical shell resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[PWA Service Worker] Pre-caching core application shell");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[PWA Service Worker] Core loading deferred, caching dynamically on-the-fly: ", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Active Event: Clean old cache versions to free up disk space
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[PWA Service Worker] Discarding stale active cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Robust Fetch Handler with strict IPTV Bypass Rules
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // STREAM / API BYPASS RULES:
  // Never cache active video segments (.ts, .m3u8, keys), visitor APIs, or websockets from server
  const isVideoSegment = url.pathname.endsWith(".ts") || 
                          url.pathname.endsWith(".m3u8") || 
                          url.pathname.includes("/key/") ||
                          url.searchParams.has("ts") ||
                          url.searchParams.has("token");
  const isServerApi = url.pathname.includes("/api/") || url.pathname.startsWith("/api");
  const isHotReload = url.pathname.includes("hot-update") || url.pathname.includes("socket.io");

  if (isVideoSegment || isServerApi || isHotReload || event.request.method !== "GET") {
    // Return direct network fetch immediately without interacting with custom disk storage cache
    return;
  }

  // Handle standard static app files (JS, CSS, HTML, Config)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fast UI feedback style: Return cache immediately, then fetch update quietly in background (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore offline network errors during background update check
          });
        return cachedResponse;
      }

      // Fallback to real-time network request, and store statically loaded files on success
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic" && networkResponse.type !== "cors") {
            return networkResponse;
          }

          // Dynamically store success resources (like Google fonts, icons, etc.)
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // If offline and request is browser navigation page, display main index.html structure
          if (event.request.mode === "navigate") {
            return caches.match("./index.html") || caches.match("./");
          }
        });
    })
  );
});
