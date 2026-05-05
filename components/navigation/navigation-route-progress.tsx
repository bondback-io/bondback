"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BondBackWordmark } from "@/components/brand/bondback-wordmark";
import { getNavigationLoadingLabel } from "@/lib/navigation-route-labels";

function isSameRoute(a: string, b: string): boolean {
  return a === b;
}

/** Matches `usePathname` + `useSearchParams` route key used in this component. */
function routeKeyFromWindowLocation(): string {
  const path = window.location.pathname;
  const sp = new URLSearchParams(window.location.search);
  return `${path}?${sp.toString()}`;
}

/** Wait before showing overlay so fast navigations never flash UI. */
const OVERLAY_DELAY_MS = 120;

function NavigationRouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [navigating, setNavigating] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Loading…");

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRouteEffectRef = useRef(true);
  const pendingNavigationRef = useRef(false);
  /** Latest route key — updated every render so popstate can detect “router already committed”. */
  const routeKeyRef = useRef(routeKey);
  routeKeyRef.current = routeKey;

  const clearTimers = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (overlayDelayRef.current) {
      clearTimeout(overlayDelayRef.current);
      overlayDelayRef.current = null;
    }
  };

  useEffect(() => {
    if (isFirstRouteEffectRef.current) {
      isFirstRouteEffectRef.current = false;
      return;
    }
    // Any URL change means navigation finished. Do not require pendingNavigationRef: on browser
    // back, Next/App Router can update pathname before the popstate listener runs, so pending is
    // still false once — then popstate starts the bar and routeKey never updates again (stuck ~90%).
    pendingNavigationRef.current = false;
    clearTimers();
    setOverlayVisible(false);
    setNavigating(false);
    setProgress(100);
    hideTimeoutRef.current = setTimeout(() => {
      setProgress(0);
    }, 200);
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [routeKey]);

  useEffect(() => {
    const start = (nextLabel: string) => {
      pendingNavigationRef.current = true;
      clearTimers();
      setLabel(nextLabel);
      setProgress(6);
      setNavigating(true);
      setOverlayVisible(false);

      overlayDelayRef.current = setTimeout(() => {
        overlayDelayRef.current = null;
        if (pendingNavigationRef.current) {
          setOverlayVisible(true);
        }
      }, OVERLAY_DELAY_MS);

      progressIntervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 89) return p;
          const room = 90 - p;
          return p + Math.min(room, 4 + Math.random() * 9 + room * 0.04);
        });
      }, 95);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href]");
      if (!a) return;
      if (a.getAttribute("target") === "_blank") return;
      if (a.hasAttribute("download")) return;
      // Same-page hash / client-handled links (e.g. profile TO DO) — never show route progress.
      if (a.hasAttribute("data-skip-route-progress")) return;

      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const next = url.pathname + url.search;
      const current = window.location.pathname + window.location.search;
      if (isSameRoute(next, current)) return;

      start(getNavigationLoadingLabel(url.pathname, url.search));
    };

    const onPopState = () => {
      const keyNow = routeKeyFromWindowLocation();
      if (keyNow === routeKeyRef.current) {
        // Next.js often applies the URL before this listener runs; starting the bar here would
        // leave it stuck (~90%) because routeKey would not change again.
        return;
      }
      start("Loading page…");
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, []);

  if (!navigating && progress === 0) {
    return null;
  }

  const pct = Math.min(100, Math.round(progress));

  return (
    <>
      {/* Thin top strip — always visible while navigating (feedback even before overlay) */}
      {navigating ? (
        <div
          className="pointer-events-none fixed left-0 right-0 top-0 z-[401] h-1 overflow-hidden bg-muted/50 dark:bg-gray-800/60"
          aria-hidden
        >
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {/* Same visual language as post-login (gradient + centered brand), scaled down for in-app nav */}
      {navigating && overlayVisible ? (
        <div
          className="pointer-events-none fixed inset-0 z-[400] flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-muted/30 dark:from-primary/10 dark:to-gray-950/80"
            aria-hidden
          />
          <div className="relative flex w-full max-w-md flex-col items-center text-center">
            <BondBackWordmark
              variant="labeled"
              className="h-10 max-h-12 max-w-[min(17rem,85vw)] sm:h-11 sm:max-h-[3.25rem] md:h-12 md:max-w-[19rem]"
            />
            <p className="mt-2 text-[11px] text-muted-foreground/90 sm:text-xs">Loading page</p>
            <div className="mt-8 flex flex-col items-center gap-5 sm:mt-9">
              <Loader2
                className="h-8 w-8 animate-spin text-primary/90 sm:h-9 sm:w-9"
                strokeWidth={1.75}
                aria-hidden
              />
              <div className="h-1.5 w-full max-w-[17rem] overflow-hidden rounded-full bg-muted/90 dark:bg-gray-800/90">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="max-w-[22rem] text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <span className="tabular-nums font-semibold text-foreground/90 dark:text-gray-100">{pct}%</span>
                <span className="mx-1.5 text-border dark:text-gray-600" aria-hidden>
                  ·
                </span>
                <span>{label}</span>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * In-app navigation: top progress strip + (after a short delay) a full-screen surface
 * aligned with post-login loaders (same wordmark as the sticky header).
 */
export function NavigationRouteProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationRouteProgressInner />
    </Suspense>
  );
}
