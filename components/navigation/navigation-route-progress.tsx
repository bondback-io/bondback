"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getNavigationLoadingLabel } from "@/lib/navigation-route-labels";

function isSameRoute(a: string, b: string): boolean {
  return a === b;
}

function NavigationRouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Loading…");

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRouteEffectRef = useRef(true);
  const pendingNavigationRef = useRef(false);

  const clearTimers = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (isFirstRouteEffectRef.current) {
      isFirstRouteEffectRef.current = false;
      return;
    }
    if (!pendingNavigationRef.current) {
      return;
    }
    pendingNavigationRef.current = false;
    clearTimers();
    setProgress(100);
    hideTimeoutRef.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 380);
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
      setActive(true);
      setLabel(nextLabel);
      setProgress(5);
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
      start("Loading…");
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, []);

  if (!active && progress === 0) {
    return null;
  }

  const pct = Math.min(100, Math.round(progress));

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[200] flex flex-col"
      aria-live="polite"
      aria-busy={active}
    >
      <div className="h-1 w-full overflow-hidden bg-muted/60 dark:bg-gray-800/80">
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-out dark:bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-center px-3 pb-1 pt-1.5">
        <div className="max-w-[min(100%,28rem)] rounded-b-md border border-t-0 border-border/80 bg-background/95 px-3 py-1 shadow-sm backdrop-blur-md dark:border-gray-700 dark:bg-gray-950/95">
          <p className="text-center text-[11px] font-medium leading-snug text-muted-foreground dark:text-gray-300 sm:text-xs">
            <span className="tabular-nums text-foreground/90 dark:text-gray-100">{pct}%</span>
            <span className="mx-1.5 text-border dark:text-gray-600" aria-hidden>
              ·
            </span>
            <span>{label}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Top progress bar + label for client-side navigations that take noticeable time.
 * Wraps inner in Suspense for useSearchParams.
 */
export function NavigationRouteProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationRouteProgressInner />
    </Suspense>
  );
}
