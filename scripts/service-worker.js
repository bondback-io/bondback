/**
 * Bond Back PWA Service Worker — advanced caching for optimal mobile performance.
 * Copy this file to public/service-worker.js (e.g. cp scripts/service-worker.js public/service-worker.js).
 * Versioned cache (bondback-v1); update CACHE_VERSION on deploy.
 * Strategies: light shell cache-first, images cache-first, API network-first,
 * Next `/_next/*` assets network-first (prevents stale chunk vs new HTML after deploy),
 * listed app routes network-first for navigations (was SWR stale-first — caused refresh thrash).
 */

const CACHE_VERSION = "bondback-v3";
const SHELL_CACHE = CACHE_VERSION + "-shell";
const IMAGES_CACHE = CACHE_VERSION + "-images";
const PAGES_CACHE = CACHE_VERSION + "-pages";
const API_CACHE = CACHE_VERSION + "-api";

// Images are cached in IMAGES_CACHE; 30-day effective TTL via cache version bump on deploy

const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/offline",
  "/icon"
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

/** Next.js hashed bundles, CSS, RSC flight, etc. — must not be cache-first or old tabs break after deploy. */
function isNextBuildAssetRequest(url) {
  return new URL(url).pathname.startsWith("/_next/");
}

/**
 * Small static shell only (not `/_next/*`). JS/CSS chunks live under `/_next/static` and use network-first.
 */
function isAppShellRequest(url) {
  const path = new URL(url).pathname;
  return (
    path === "/" ||
    path === "/manifest.json" ||
    path === "/offline" ||
    path === "/icon" ||
    /^\/(icons\/|favicon)/.test(path)
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
  return SWR_PATHS.some((p) => {
    // Only the jobs list — NOT /jobs/123 (dynamic job detail). SWR there serves stale HTML
    // and caused "Page not found" / broken navigations when cache was out of date.
    if (p === "/jobs") {
      return path === "/jobs" || path === "/jobs/";
    }
    return path === p || path.startsWith(p + "/");
  });
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

// ————— Background Sync: offline pending bids —————
const OFFLINE_DB_NAME = "bondback_offline";
const PENDING_BIDS_STORE = "pending_bids";
const PENDING_BIDS_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PENDING_BIDS_STORE)) {
        db.createObjectStore(PENDING_BIDS_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

function getAllPendingBids(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_BIDS_STORE, "readonly");
    const store = tx.objectStore(PENDING_BIDS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function deletePendingBid(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_BIDS_STORE, "readwrite");
    const store = tx.objectStore(PENDING_BIDS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function notifyClientsBidsSynced(syncedCount) {
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      client.postMessage({ type: "PENDING_BIDS_SYNCED", count: syncedCount });
    });
  });
}

self.addEventListener("sync", (event) => {
  if (event.tag !== "sync-pending-bids") return;
  event.waitUntil(
    openOfflineDB()
      .then((db) => {
        return getAllPendingBids(db).then((bids) => {
          const now = Date.now();
          const valid = bids.filter((b) => b.timestamp && now - b.timestamp < PENDING_BIDS_EXPIRE_MS);
          const expired = bids.filter((b) => b.timestamp && now - b.timestamp >= PENDING_BIDS_EXPIRE_MS);
          const expirePromises = expired
            .filter((b) => b.id != null)
            .map((b) => deletePendingBid(db, b.id));
          let syncedCount = 0;
          const syncedJobIds = [];
          const apiUrl = new URL("/api/bids", self.location.origin).href;
          const sendPushUrl = new URL("/api/send-push", self.location.origin).href;
          return Promise.all(expirePromises)
            .then(() => valid
            .reduce((chain, bid) => {
              return chain.then(() => {
                return fetch(apiUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    listingId: String(bid.jobId),
                    amountCents: Number(bid.amount),
                  }),
                  credentials: "include",
                })
                  .then((res) => {
                    if (res.ok) {
                      syncedCount++;
                      syncedJobIds.push(String(bid.jobId));
                      return deletePendingBid(db, bid.id);
                    }
                    if (res.status >= 400 && res.status < 500) {
                      return deletePendingBid(db, bid.id);
                    }
                    return Promise.resolve();
                  })
                  .catch(() => {});
              });
            }, Promise.resolve()))
            .then(() => {
              db.close();
              if (syncedCount > 0) {
                notifyClientsBidsSynced(syncedCount);
                fetch(sendPushUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "bid_sync_success",
                    jobIds: syncedJobIds,
                    syncedCount: syncedCount,
                  }),
                  credentials: "include",
                }).catch(function () {});
              } else if (valid.length > 0) {
                fetch(sendPushUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "bid_sync_failure" }),
                  credentials: "include",
                }).catch(function () {});
              }
            });
        });
      })
      .catch(() => {})
  );
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

  const pathname = reqUrl.pathname;
  const isJobsListApi = pathname === "/api/jobs" && request.method === "GET";
  const jobDetailMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
  const isJobDetailApi = jobDetailMatch && request.method === "GET";

  // 0) Jobs API: network-first with IndexedDB fallback (offline job viewing)
  if (isJobsListApi || isJobDetailApi) {
    const cacheKey = isJobsListApi ? "list" : "job_" + jobDetailMatch[1];
    event.respondWith(
      fetch(request)
        .then(function (res) {
          if (!res.ok) return res;
          const ct = res.headers.get("content-type") || "";
          if (!/^application\/json/i.test(ct)) return res;
          return res.clone().json().then(function (data) {
            return new Promise(function (resolve) {
              const dbReq = indexedDB.open("bondback_jobs_cache", 1);
              dbReq.onerror = function () { resolve(res); };
              dbReq.onsuccess = function () {
                const db = dbReq.result;
                if (!db.objectStoreNames.contains("cache")) {
                  db.close();
                  resolve(res);
                  return;
                }
                const tx = db.transaction("cache", "readwrite");
                const store = tx.objectStore("cache");
                const now = Date.now();
                store.put({ data: data, fetchedAt: now }, cacheKey);
                store.put(now, "last_sync");
                tx.oncomplete = function () {
                  db.close();
                  resolve(res);
                };
                tx.onerror = function () {
                  db.close();
                  resolve(res);
                };
              };
              dbReq.onupgradeneeded = function (e) {
                if (!e.target.result.objectStoreNames.contains("cache")) {
                  e.target.result.createObjectStore("cache");
                }
              };
            });
          }).catch(function () {
            return res;
          });
        })
        .catch(function () {
          return new Promise(function (resolve, reject) {
            const dbReq = indexedDB.open("bondback_jobs_cache", 1);
            dbReq.onerror = function () {
              resolve(new Response(JSON.stringify({ error: "Offline" }), {
                status: 503,
                headers: { "Content-Type": "application/json" }
              }));
            };
            dbReq.onsuccess = function () {
              const db = dbReq.result;
              if (!db.objectStoreNames.contains("cache")) {
                db.close();
                resolve(new Response(JSON.stringify({ error: "Offline" }), {
                  status: 503,
                  headers: { "Content-Type": "application/json" }
                }));
                return;
              }
              const tx = db.transaction("cache", "readonly");
              const store = tx.objectStore("cache");
              const getReq = store.get(cacheKey);
              getReq.onsuccess = function () {
                db.close();
                const entry = getReq.result;
                if (entry && entry.data != null) {
                  resolve(new Response(JSON.stringify(entry.data), {
                    headers: { "Content-Type": "application/json" }
                  }));
                } else {
                  resolve(new Response(JSON.stringify({ error: "Offline" }), {
                    status: 503,
                    headers: { "Content-Type": "application/json" }
                  }));
                }
              };
              getReq.onerror = function () {
                db.close();
                resolve(new Response(JSON.stringify({ error: "Offline" }), {
                  status: 503,
                  headers: { "Content-Type": "application/json" }
                }));
              };
            };
            dbReq.onupgradeneeded = function (e) {
              if (!e.target.result.objectStoreNames.contains("cache")) {
                e.target.result.createObjectStore("cache");
              }
            };
          });
        })
    );
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

  // 2) Next build output: network-first (then cache for offline). Avoids post-deploy chunk/HTML mismatch loops.
  if (isNextBuildAssetRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3) App shell (tiny): cache-first
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

  // 4) Images: cache-first (30-day effective TTL via cache version on deploy)
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

  // 5) Navigation to listed app pages: network-first (same as other navigations). Stale-first HTML +
  //    cached `/_next/*` after a deploy caused hard-to-debug refresh loops for logged-in users.
  if (isNavigationRequest(request) && isSwrPageRequest(url)) {
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

  // 6) Other navigations: network first, offline fallback
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

  // 7) Other GET: network first
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
