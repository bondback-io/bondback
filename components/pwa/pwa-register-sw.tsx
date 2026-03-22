"use client";

import { useEffect } from "react";

/** Cache version must match service-worker.js CACHE_VERSION when deploying. */
const SW_URL = "/service-worker.js";
const SW_SCOPE = "/";

export function PwaRegisterSw() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

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

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
