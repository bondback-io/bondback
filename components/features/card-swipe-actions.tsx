"use client";

import * as React from "react";
import { useSwipeable } from "react-swipeable";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Minimum horizontal distance (px) to count as an intentional swipe */
const THRESHOLD_PX = 80;
/** Alternative: fast flick with shorter travel */
const SHORT_DISTANCE_PX = 42;
/** Velocity threshold (react-swipeable units, ~px/ms) for a quick flick */
const VELOCITY_THRESHOLD = 0.35;
const MAX_DRAG_PX = 120;

function vibrateShort() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    (navigator as Navigator & { vibrate: (n: number | number[]) => boolean }).vibrate(
      18
    );
  }
}

function shouldTriggerSwipe(deltaX: number, velocity?: number): boolean {
  const abs = Math.abs(deltaX);
  if (abs >= THRESHOLD_PX) return true;
  if (abs >= SHORT_DISTANCE_PX && typeof velocity === "number" && Math.abs(velocity) >= VELOCITY_THRESHOLD) {
    return true;
  }
  return false;
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
  /** Swipe right (finger moves right, +Δx): primary action — green panel */
  onSwipeRight?: () => void;
  /** Swipe left (−Δx): secondary action — yellow panel */
  onSwipeLeft?: () => void;
  rightIcon?: LucideIcon;
  leftIcon?: LucideIcon;
  rightActionLabel?: string;
  leftActionLabel?: string;
};

/**
 * Mobile-only (&lt;768px) horizontal swipe with green (right) / yellow (left) underlays.
 * Desktop: no swipe; children render unchanged.
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
      const vel =
        typeof (e as { velocity?: number }).velocity === "number"
          ? (e as { velocity: number }).velocity
          : undefined;
      if (dx > 0 && onSwipeRight && shouldTriggerSwipe(dx, vel)) {
        vibrateShort();
        onSwipeRight();
      } else if (dx < 0 && onSwipeLeft && shouldTriggerSwipe(dx, vel)) {
        vibrateShort();
        onSwipeLeft();
      }
      setOffset(0);
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
    delta: 10,
  });

  const onKeyDown = React.useCallback(
    (ev: React.KeyboardEvent) => {
      if (!isMobile) return;
      if (ev.key === "ArrowRight" && onSwipeRight) {
        ev.preventDefault();
        vibrateShort();
        onSwipeRight();
      } else if (ev.key === "ArrowLeft" && onSwipeLeft) {
        ev.preventDefault();
        vibrateShort();
        onSwipeLeft();
      }
    },
    [isMobile, onSwipeLeft, onSwipeRight]
  );

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  if (!onSwipeRight && !onSwipeLeft) {
    return <div className={className}>{children}</div>;
  }

  const leftRevealOpacity =
    offset > 8 ? Math.min(1, offset / THRESHOLD_PX) : 0;
  const rightRevealOpacity =
    offset < -8 ? Math.min(1, -offset / THRESHOLD_PX) : 0;

  return (
    <div
      {...handlers}
      {...(onSwipeRight || onSwipeLeft
        ? {
            tabIndex: 0,
            role: "group",
            "aria-label":
              onSwipeRight && onSwipeLeft
                ? "Swipe right or left for actions, or use arrow keys"
                : onSwipeRight
                  ? "Swipe right for action, or press Arrow Right"
                  : "Swipe left for action, or press Arrow Left",
            onKeyDown,
          }
        : {})}
      className={cn(
        "relative touch-pan-y overflow-hidden rounded-xl md:overflow-visible",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      {/* Green underlay — swipe right (reveals from left) */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-0 flex w-[min(100%,8rem)] items-center justify-center rounded-l-xl bg-emerald-600 text-white shadow-inner dark:bg-emerald-600"
        style={{ opacity: leftRevealOpacity }}
        aria-hidden
      >
        {RightIcon ? (
          <span className="flex flex-col items-center gap-1 px-1">
            <RightIcon
              className={cn(
                "h-9 w-9 shrink-0 transition-transform duration-150",
                offset > 40 && "scale-110"
              )}
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="max-w-[5.5rem] text-center text-[10px] font-semibold leading-tight opacity-95">
              {rightActionLabel}
            </span>
          </span>
        ) : null}
      </div>

      {/* Yellow underlay — swipe left (reveals from right) */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-0 flex w-[min(100%,8rem)] items-center justify-center rounded-r-xl bg-yellow-400 text-yellow-950 shadow-inner dark:bg-yellow-500 dark:text-yellow-950"
        style={{ opacity: rightRevealOpacity }}
        aria-hidden
      >
        {LeftIcon ? (
          <span className="flex flex-col items-center gap-1 px-1">
            <LeftIcon
              className={cn(
                "h-9 w-9 shrink-0 transition-transform duration-150",
                offset < -40 && "scale-110"
              )}
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="max-w-[5.5rem] text-center text-[10px] font-semibold leading-tight opacity-95">
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
