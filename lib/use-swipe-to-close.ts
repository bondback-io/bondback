"use client";

import { useCallback, useRef } from "react";

const SWIPE_THRESHOLD = 50;

type Direction = "right" | "left" | "down" | "up";

/**
 * Returns touch handlers for swipe-to-close.
 * - For side="right" sheet: use direction "right" (swipe right to close).
 * - For side="bottom" sheet: use direction "down" (swipe down to close).
 */
export function useSwipeToClose(
  onClose: () => void,
  direction: Direction
) {
  const start = useRef({ x: 0, y: 0 });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    start.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - start.current.x;
      const dy = endY - start.current.y;

      if (direction === "right" && dx > SWIPE_THRESHOLD) {
        onClose();
      } else if (direction === "left" && dx < -SWIPE_THRESHOLD) {
        onClose();
      } else if (direction === "down" && dy > SWIPE_THRESHOLD) {
        onClose();
      } else if (direction === "up" && dy < -SWIPE_THRESHOLD) {
        onClose();
      }
    },
    [onClose, direction]
  );

  return { onTouchStart, onTouchEnd };
}
