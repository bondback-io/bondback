"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PullToRefreshProps = {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
};

/**
 * Pull down at the top of the page (when scrollY is 0) to refresh server data.
 */
export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const armed = useRef(false);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
      pullRef.current = 0;
      setPull(0);
    }
  }, [busy, onRefresh]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 4) return;
      armed.current = true;
      startY.current = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!armed.current || window.scrollY > 4) return;
      const y = e.touches[0]?.clientY ?? 0;
      const dy = y - startY.current;
      if (dy > 0) {
        const next = Math.min(dy * 0.4, 56);
        pullRef.current = next;
        setPull(next);
      }
    };
    const onTouchEnd = () => {
      if (!armed.current) return;
      armed.current = false;
      if (pullRef.current > 28) void run();
      else {
        pullRef.current = 0;
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [run]);

  return (
    <div className="relative">
      <div
        className={cn(
          "pointer-events-none fixed left-0 right-0 top-0 z-20 flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]",
          (pull > 0 || busy) && "opacity-100"
        )}
        style={{
          opacity: pull > 0 || busy ? 1 : 0,
          transform: `translateY(${Math.min(pull + (busy ? 8 : 0), 64)}px)`,
          transition: pull === 0 && !busy ? "opacity 0.2s" : undefined,
        }}
        aria-hidden
      >
        <Loader2
          className={cn("h-6 w-6 text-emerald-600 dark:text-emerald-400", busy && "animate-spin")}
        />
      </div>
      {children}
    </div>
  );
}
