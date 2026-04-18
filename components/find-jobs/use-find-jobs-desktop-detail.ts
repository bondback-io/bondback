"use client";

import * as React from "react";

/** Min width for split list + map with detail overlay on the map column (Tailwind `xl`). Below this, use full-width sheet. */
export const FIND_JOBS_DESKTOP_DETAIL_MIN_PX = 1280;

/**
 * True when the viewport is wide enough for the Find Jobs desktop detail overlay (not cramped).
 * Below this, {@link FindJobsMobileDetailSheet} should be used instead.
 */
export function useFindJobsDesktopDetailOverlay(): boolean {
  const [wideEnough, setWideEnough] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${FIND_JOBS_DESKTOP_DETAIL_MIN_PX}px)`);
    const apply = () => setWideEnough(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return wideEnough;
}
