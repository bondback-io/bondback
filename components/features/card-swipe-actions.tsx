"use client";

import * as React from "react";
import { useSwipeable } from "react-swipeable";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD_PX = 72;
const MAX_DRAG_PX = 100;

function vibrateShort() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    (navigator as Navigator & { vibrate: (n: number | number[]) => boolean }).vibrate(
      16
    );
  }
}

export function useIsMobileSwipeWidth() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

export type CardSwipeActionsProps = {
  children: React.ReactNode;
  className?: string;
  /** Swipe right (finger moves right, +Δx): green panel on the left — e.g. Quick bid / View bids / Mark complete */
  onSwipeRight?: () => void;
  /** Swipe left (−Δx): amber panel on the right — e.g. Save / Message / Cancel */
  onSwipeLeft?: () => void;
  /** Icon shown on the green (right-swipe) reveal */
  rightIcon?: LucideIcon;
  /** Icon shown on the amber (left-swipe) reveal */
  leftIcon?: LucideIcon;
  /** Accessible labels for overlays */
  rightActionLabel?: string;
  leftActionLabel?: string;
};

/**
 * Mobile-only (&lt;768px) horizontal swipe with coloured underlays and icons.
 * Desktop: inert wrapper (no swipe, no overflow clipping).
 */
export function CardSwipeActions({
  children,
  className,
  onSwipeRight,
  onSwipeLeft,
  rightIcon: RightIcon,
  leftIcon: LeftIcon,
  rightActionLabel = "Primary action",
  leftActionLabel = "Secondary action",
}: CardSwipeActionsProps) {
  const isMobile = useIsMobileSwipeWidth();
  const [offset, setOffset] = React.useState(0);

  const handlers = useSwipeable({
    onSwiping: (e) => {
      let x = e.deltaX;
      if (!onSwipeRight && x > 0) x = 0;
      if (!onSwipeLeft && x < 0) x = 0;
      setOffset(Math.max(-MAX_DRAG_PX, Math.min(MAX_DRAG_PX, x)));
    },
    onSwiped: (e) => {
      const dx = e.deltaX;
      if (dx >= THRESHOLD_PX && onSwipeRight) {
        vibrateShort();
        onSwipeRight();
      } else if (dx <= -THRESHOLD_PX && onSwipeLeft) {
        vibrateShort();
        onSwipeLeft();
      }
      setOffset(0);
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
  });

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  if (!onSwipeRight && !onSwipeLeft) {
    return <div className={className}>{children}</div>;
  }

  const leftRevealOpacity =
    offset > 8 ? Math.min(1, offset / 72) : 0;
  const rightRevealOpacity =
    offset < -8 ? Math.min(1, -offset / 72) : 0;

  return (
    <div
      {...handlers}
      className={cn(
        "relative overflow-hidden rounded-xl md:overflow-visible",
        className
      )}
    >
      {/* Green underlay: revealed when swiping right */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-0 flex w-[min(100%,7rem)] items-center justify-center rounded-l-xl bg-emerald-600 text-white shadow-inner dark:bg-emerald-600"
        style={{ opacity: leftRevealOpacity }}
        aria-hidden
      >
        {RightIcon ? (
          <span className="flex flex-col items-center gap-0.5 px-1">
            <RightIcon className="h-8 w-8 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="max-w-[5rem] text-center text-[10px] font-semibold leading-tight opacity-95">
              {rightActionLabel}
            </span>
          </span>
        ) : null}
      </div>

      {/* Amber underlay: revealed when swiping left */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-0 flex w-[min(100%,7rem)] items-center justify-center rounded-r-xl bg-amber-400 text-amber-950 shadow-inner dark:bg-amber-500 dark:text-amber-950"
        style={{ opacity: rightRevealOpacity }}
        aria-hidden
      >
        {LeftIcon ? (
          <span className="flex flex-col items-center gap-0.5 px-1">
            <LeftIcon className="h-8 w-8 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="max-w-[5rem] text-center text-[10px] font-semibold leading-tight opacity-95">
              {leftActionLabel}
            </span>
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "relative z-10",
          Math.abs(offset) > 0.5
            ? "transition-none"
            : "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
