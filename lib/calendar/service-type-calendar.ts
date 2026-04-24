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
