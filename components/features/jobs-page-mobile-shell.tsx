"use client";

import { BackToTop } from "@/components/features/back-to-top";

/**
 * Mobile jobs page chrome (back-to-top).
 * Scroll-hide on filters was removed: transform + sticky caused janky mobile layout.
 */
export function JobsPageMobileShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BackToTop />
    </>
  );
}
