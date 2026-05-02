/**
 * Calendar cell / legend colours by `listings.service_type` (Tailwind classes).
 */
import type { ServiceTypeKey } from "@/lib/service-types";
import { normalizeServiceType } from "@/lib/service-types";

export const CALENDAR_EVENT_DOT_CLASS: Record<ServiceTypeKey, string> = {
  bond_cleaning: "bg-violet-500 dark:bg-violet-400",
  airbnb_turnover: "bg-sky-500 dark:bg-sky-400",
  recurring_house_cleaning: "bg-emerald-500 dark:bg-emerald-400",
  deep_clean: "bg-amber-500 dark:bg-amber-400",
};

/**
 * Listing picker row accents — same hues as {@link CALENDAR_EVENT_DOT_CLASS}.
 */
export const CALENDAR_SERVICE_TYPE_ROW_ACCENT: Record<
  ServiceTypeKey,
  {
    iconWell: string;
    rowBorderLeft: string;
    chevron: string;
    focusRing: string;
  }
> = {
  bond_cleaning: {
    iconWell:
      "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/40 dark:bg-violet-400/20 dark:text-violet-50 dark:ring-violet-400/35",
    rowBorderLeft: "border-l-violet-500 dark:border-l-violet-400",
    chevron: "text-violet-300/85 dark:text-violet-200/80",
    focusRing:
      "focus-visible:ring-violet-400 focus-visible:ring-offset-emerald-950",
  },
  airbnb_turnover: {
    iconWell:
      "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40 dark:bg-sky-400/20 dark:text-sky-50 dark:ring-sky-400/35",
    rowBorderLeft: "border-l-sky-500 dark:border-l-sky-400",
    chevron: "text-sky-300/85 dark:text-sky-200/80",
    focusRing:
      "focus-visible:ring-sky-400 focus-visible:ring-offset-emerald-950",
  },
  recurring_house_cleaning: {
    iconWell:
      "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40 dark:bg-emerald-400/20 dark:text-emerald-50 dark:ring-emerald-400/35",
    rowBorderLeft: "border-l-emerald-500 dark:border-l-emerald-400",
    chevron: "text-emerald-300/85 dark:text-emerald-200/80",
    focusRing:
      "focus-visible:ring-emerald-400 focus-visible:ring-offset-emerald-950",
  },
  deep_clean: {
    iconWell:
      "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40 dark:bg-amber-400/20 dark:text-amber-50 dark:ring-amber-400/35",
    rowBorderLeft: "border-l-amber-500 dark:border-l-amber-400",
    chevron: "text-amber-300/85 dark:text-amber-200/80",
    focusRing:
      "focus-visible:ring-amber-400 focus-visible:ring-offset-emerald-950",
  },
};

export const CALENDAR_EVENT_LEGEND_LABEL: Record<ServiceTypeKey, string> = {
  bond_cleaning: "Bond clean",
  airbnb_turnover: "Airbnb turnover",
  recurring_house_cleaning: "Recurring clean",
  deep_clean: "Deep / spring / inspection",
};

export function calendarDotClassForService(raw: string | null | undefined): string {
  const k = normalizeServiceType(raw);
  return CALENDAR_EVENT_DOT_CLASS[k] ?? "bg-muted-foreground";
}
