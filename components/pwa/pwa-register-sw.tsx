"use client";

import { useEffect } from "react";

/** Keep in sync with `scripts/service-worker.js` CACHE_VERSION (bump there on SW logic changes). */
const SW_URL = "/service-worker.js";
const SW_SCOPE = "/";

const CHUNK_RECOVER_WINDOW_MS = 10_000;

function isLikelyStaleChunkError(message: string): boolean {
  return (
    /chunk load error/i.test(message) ||
    /loading chunk \d+ failed/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /import\(\) failed/i.test(message) ||
    /loading css chunk/i.test(message)
  );
}

/** One guarded full reload when a deploy invalidates cached JS (avoids infinite loops). */
function maybeRecoverFromDeployChunkError(): void {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem("bb_chunk_recover_at");
    const last = raw ? Number.parseInt(raw, 10) : 0;
    if (Number.isFinite(last) && last > 0 && now - last < CHUNK_RECOVER_WINDOW_MS) {
      return;
    }
    sessionStorage.setItem("bb_chunk_recover_at", String(now));
  } catch {
    return;
  }
  window.setTimeout(() => window.location.reload(), 0);
}

export function PwaRegisterSw() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg =
        typeof r === "object" && r !== null && "message" in r && typeof (r as Error).message === "string"
          ? (r as Error).message
          : String(r ?? "");
      if (!isLikelyStaleChunkError(msg)) return;
      e.preventDefault();
      maybeRecoverFromDeployChunkError();
    };

    const onError = (e: ErrorEvent) => {
      const msg = e.message || "";
      if (!isLikelyStaleChunkError(msg)) return;
      const t = e.target;
      if (t instanceof HTMLScriptElement || t instanceof HTMLLinkElement) {
        maybeRecoverFromDeployChunkError();
      }
    };

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError, true);

    const register = () => {
      navigator.serviceWorker
        .register(SW_URL, { scope: SW_SCOPE })
        .then((reg) => {
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
          // SW not supported or failed to register (e.g. not HTTPS in prod)
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);

    /**
     * Do **not** call `location.reload()` on `controllerchange`. The service worker already uses
     * `skipWaiting()` during `install`, so a forced reload here caused a refresh loop on production
     * (activate → controllerchange → reload → register → …). New worker code applies on the next
     * navigation or a later visit without a full-page loop.
     */

    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError, true);
    };
  }, []);

  return null;
}
