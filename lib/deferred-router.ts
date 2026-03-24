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
