/**
 * Matches `FindJobsSplitLayout`: map sits beside the list from this width (Tailwind `lg`).
 * Below this, the map lives in the bottom sheet / FAB — do not run map flyTo / focus.
 */
export const FIND_JOBS_MAP_SPLIT_MIN_PX = 1024;

export function isFindJobsMapSplitLayoutVisible(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(min-width: ${FIND_JOBS_MAP_SPLIT_MIN_PX}px)`).matches;
}
