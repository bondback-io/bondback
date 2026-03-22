"use client";

import { StickyFilterBehavior } from "@/components/features/sticky-filter-behavior";
import { BackToTop } from "@/components/features/back-to-top";

/**
 * Mobile jobs page chrome (sticky filters + back-to-top).
 * Pull-to-refresh was removed here — it duplicated JobsList's pull wrapper and
 * fought vertical scrolling / browser gestures.
 */
export function JobsPageMobileShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StickyFilterBehavior />
      {children}
      <BackToTop />
    </>
  );
}
