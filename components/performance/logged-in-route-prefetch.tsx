"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** High-value authenticated routes — prefetched after idle to speed up common navigation. */
const PREFETCH_ROUTES = [
  "/profile",
  "/my-listings",
  "/messages",
  "/help",
  "/support",
  "/listings/new",
  "/jobs",
  "/lister/dashboard",
  "/cleaner/dashboard",
  "/earnings",
  "/cleaners",
] as const;

/**
 * Runs once per mount when the user is logged in. Uses requestIdleCallback when available
 * so prefetch work does not compete with first paint.
 */
export function LoggedInRoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      for (const path of PREFETCH_ROUTES) {
        router.prefetch(path);
      }
    };

    const ric = typeof window !== "undefined" ? window.requestIdleCallback : undefined;
    if (typeof ric === "function") {
      const id = ric(() => run(), { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(run, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [router]);

  return null;
}
