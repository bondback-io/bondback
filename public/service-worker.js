/**
 * Bond Back PWA Service Worker — advanced caching for optimal mobile performance.
 * Copy this file to public/service-worker.js (e.g. cp scripts/service-worker.js public/service-worker.js).
 * Versioned cache (bondback-v1); update CACHE_VERSION on deploy.
 * Strategies: app shell cache-first, images cache with TTL, API network-first, pages stale-while-revalidate.
 */

const CACHE_VERSION = "bondback-v1";
const SHELL_CACHE = CACHE_VERSION + "-shell";
const IMAGES_CACHE = CACHE_VERSION + "-images";
const PAGES_CACHE = CACHE_VERSION + "-pages";
const API_CACHE = CACHE_VERSION + "-api";

// Images are cached in IMAGES_CACHE; 30-day effective TTL via cache version bump on deploy

const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/offline",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// Paths that get stale-while-revalidate (semi-dynamic)
const SWR_PATHS = [
  "/dashboard",
  "/lister/dashboard",
  "/cleaner/dashboard",
  "/profile",
  "/settings",
  "/jobs",
  "/my-listings"
];

function isAppShellRequest(url) {
  const path = new URL(url).pathname;
  return (
    path === "/" ||
    path === "/manifest.json" ||
    path === "/offline" ||
    /^\/(_next\/static\/|icons\/|favicon)/.test(path) ||
    /\.(js|css|woff2?)$/i.test(path)
  );
}

function isApiRequest(url) {
  const path = new URL(url).pathname;
  return path.startsWith("/api/");
}

function isImageRequest(url) {
  const path = new URL(url).pathname;
  return (
    /\.(png|jpg|jpeg|webp|gif|ico|svg)$/i.test(path) ||
    /\/storage\/v1\/object\/public\//.test(url) ||
    path.startsWith("/icons/")
  );
}

function isSwrPageRequest(url) {
  const path = new URL(url).pathname;
  if (url.includes("_rsc=") || url.includes("?_")) return false;
  return SWR_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

// Respect network conditions: avoid aggressive cache writes on slow/saveData
function shouldThrottle() {
  try {
    return (
      typeof navigator !== "undefined" &&
      navigator.connection &&
      (navigator.connection.saveData === true ||
        navigator.connection.effectiveType === "slow-2g" ||
        navigator.connection.effectiveType === "2g")
    );
  } catch (_) {
    return false;
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      const toAdd = SHELL_URLS.filter((u) => {
        try {
          return new URL(u, self.location.origin).origin === self.location.origin;
        } catch (_) {
          return false;
        }
      });
      return cache.addAll(toAdd.map((u) => new Request(u, { cache: "reload" }))).catch(() => {});
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("bondback-") &&
              name !== SHELL_CACHE &&
              name !== IMAGES_CACHE &&
              name !== PAGES_CACHE &&
              name !== API_CACHE
          )
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  if (
    request.method !== "GET" ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("moz-extension://")
  ) {
    return;
  }

  const reqUrl = new URL(url);
  if (reqUrl.origin !== self.location.origin && !reqUrl.href.includes("/storage/v1/")) {
    return;
  }

  // 1) API: network-first with cache fallback
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          if (res.ok && /^application\/json/i.test(res.headers.get("content-type") || "")) {
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ error: "Offline" }), {
                headers: { "Content-Type": "application/json" }
              })
          )
        )
    );
    return;
  }

  // 2) App shell & static assets: cache-first
  if (isAppShellRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 3) Images: cache-first (30-day effective TTL via cache version on deploy)
  if (isImageRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(IMAGES_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 4) Navigation to SWR pages: stale-while-revalidate (return cached, revalidate in background)
  if (isNavigationRequest(request) && isSwrPageRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((res) => {
            if (res.ok && res.type === "basic" && !shouldThrottle()) {
              const clone = res.clone();
              caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
            }
            return res;
          })
          .catch(() => null);
        if (cached) {
          fetchPromise.then(() => {}); // revalidate in background
          return cached;
        }
        return fetchPromise.then((fresh) => fresh || caches.match("/offline"));
      })
    );
    return;
  }

  // 5) Other navigations: network first, offline fallback
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && res.type === "basic" && !shouldThrottle()) {
            const clone = res.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline"))
        )
    );
    return;
  }

  // 6) Other GET: network first
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (
          res.ok &&
          res.type === "basic" &&
          !shouldThrottle() &&
          isAppShellRequest(url)
        ) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
