"use client";

import { startTransition } from "react";

/**
 * Defer Next.js App Router work until after paint + transition, so the router
 * is initialized. Mitigates "Router action dispatched before initialization"
 * when auth listeners or effects run during first mount.
 */
export function scheduleRouterAction(fn: () => void): void {
  if (typeof window === "undefined") return;
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      startTransition(fn);
    });
  });
}

/**
 * After accept-bid + `router.refresh()`, scroll often stays on the bids section.
 * Smooth scroll to top so the lister sees the "Open job" banner.
 */
export function scrollToTopAfterBidAccepted(): void {
  if (typeof window === "undefined") return;
  const go = () => window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  go();
  requestAnimationFrame(go);
  window.setTimeout(go, 200);
}
