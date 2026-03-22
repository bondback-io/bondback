"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 70;
const MAX_PULL = 100;
const RESISTANCE = 0.5;

export type PullToRefreshProps = {
  children: React.ReactNode;
  /** Sync or async; spinner hides when promise resolves (or immediately if void). */
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  /** Shown when pulled far enough (e.g. "Release to refresh"). Omit to hide. */
  releaseToRefreshLabel?: string;
};

/**
 * Reusable pull-to-refresh wrapper. Uses touch/pointer events; shows indicator during pull,
 * triggers refresh on release after ~70px. Use on /jobs, /lister/dashboard, /cleaner/dashboard only.
 */
export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
  className,
  releaseToRefreshLabel = "Release to refresh",
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const scrollTopRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || disabled) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      const result = onRefresh();
      await (typeof result?.then === "function" ? result : Promise.resolve());
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, disabled]);

  const getScrollTop = useCallback(() => {
    if (typeof window === "undefined") return 0;
    return window.document.documentElement.scrollTop || window.document.body.scrollTop || 0;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || isRefreshing) return;
      scrollTopRef.current = getScrollTop();
      startY.current = e.clientY;
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    [disabled, isRefreshing, getScrollTop]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || isRefreshing) return;
      const atTop = getScrollTop() <= 8;
      const deltaY = e.clientY - startY.current;
      if (deltaY > 0 && atTop) {
        e.preventDefault();
        const resisted = Math.min(MAX_PULL, deltaY * RESISTANCE);
        setPullDistance(resisted);
      } else if (!atTop && pullDistance > 0) {
        setPullDistance(0);
      }
    },
    [disabled, isRefreshing, pullDistance, getScrollTop]
  );

  const onPointerUp = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing && !disabled) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, disabled, handleRefresh]);

  const onPointerCancel = useCallback(() => {
    setPullDistance(0);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.addEventListener("touchstart", () => {}, { passive: true });
    return () => {};
  }, []);

  const showIndicator = pullDistance > 0 || isRefreshing;
  const triggerRelease = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* Pull indicator above content */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-col items-center justify-center transition-transform duration-150 motion-reduce:transition-none"
        style={{
          transform: `translateY(${showIndicator ? 0 : -60}px)`,
          height: 72,
          marginTop: -72,
        }}
        aria-hidden
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/90 shadow-sm dark:bg-gray-800/90 motion-reduce:animate-none"
          style={{
            opacity: showIndicator ? 1 : 0,
            transform: `scale(${Math.min(1, (pullDistance || 0) / PULL_THRESHOLD)})`,
          }}
        >
          {isRefreshing ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" />
          ) : (
            <ChevronDown
              className={cn(
                "h-6 w-6 text-muted-foreground transition-transform duration-150 dark:text-gray-400 motion-reduce:transition-none",
                triggerRelease && "rotate-180"
              )}
            />
          )}
        </div>
        {releaseToRefreshLabel && triggerRelease && !isRefreshing && (
          <p className="mt-1.5 text-xs font-medium text-muted-foreground dark:text-gray-400">
            {releaseToRefreshLabel}
          </p>
        )}
      </div>

      {/* Content offset when pulling */}
      <div
        className="motion-reduce:transition-none"
        style={{
          transform: showIndicator ? `translateY(${Math.min(pullDistance, MAX_PULL) * 0.3}px)` : "translateY(0)",
          transition: isRefreshing ? "transform 0.2s ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
