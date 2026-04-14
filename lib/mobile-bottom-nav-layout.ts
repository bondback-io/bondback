/**
 * Bottom offset for fixed FABs on routes that show `MobileBottomNav` (md:hidden, z-40).
 * Keeps controls above the tab bar: matches nav `pt-2`, `min-h-[48px]` tabs + labels,
 * and `pb-[max(0.5rem,env(safe-area-inset-bottom))]`, plus a small gap.
 *
 * If tab bar height changes, update here and verify listing Q&A FAB + similar controls.
 */
export const MOBILE_BOTTOM_NAV_FAB_OFFSET =
  "max(6.75rem, calc(4.25rem + env(safe-area-inset-bottom, 0px)))";
