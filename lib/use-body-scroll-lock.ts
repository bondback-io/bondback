"use client";

import { useEffect } from "react";

/**
 * Locks body scroll when `locked` is true (e.g. when a mobile sheet is open).
 * Restores scroll on cleanup or when locked becomes false.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
