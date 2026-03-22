"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 10;
const SELECTOR = "[data-sticky-filter]";

/**
 * Listens to window scroll and toggles visibility of the sticky filter bar:
 * hide on scroll down, show on scroll up. Mobile only (desktop unchanged).
 */
export function StickyFilterBehavior() {
  const lastY = React.useRef(0);
  const ticking = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const el = document.querySelector(SELECTOR);
    if (el) el.classList.add("sticky-filter-visible");

    const update = () => {
      const target = document.querySelector(SELECTOR);
      if (!target) return;
      const y = window.scrollY;
      const delta = y - lastY.current;
      lastY.current = y;

      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        target.classList.remove("sticky-filter-hidden");
        target.classList.add("sticky-filter-visible");
        ticking.current = false;
        return;
      }

      if (Math.abs(delta) < SCROLL_THRESHOLD) {
        ticking.current = false;
        return;
      }

      if (delta > 0) {
        target.classList.add("sticky-filter-hidden");
        target.classList.remove("sticky-filter-visible");
      } else {
        target.classList.remove("sticky-filter-hidden");
        target.classList.add("sticky-filter-visible");
      }
      ticking.current = false;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
