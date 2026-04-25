"use client";

import { Building2, Home, RefreshCw, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceTypeKey } from "@/lib/service-types";
import { normalizeServiceType } from "@/lib/service-types";
import { CALENDAR_EVENT_DOT_CLASS, CALENDAR_EVENT_LEGEND_LABEL } from "@/lib/calendar/service-type-calendar";

const ICON_MAP: Record<ServiceTypeKey, LucideIcon> = {
  bond_cleaning: Home,
  airbnb_turnover: Building2,
  recurring_house_cleaning: RefreshCw,
  deep_clean: Sparkles,
};

/** Tailwind text colour aligned with calendar dot hues (for icons + chips). */
const ICON_TONE: Record<ServiceTypeKey, string> = {
  bond_cleaning: "text-violet-600 dark:text-violet-300",
  airbnb_turnover: "text-sky-600 dark:text-sky-300",
  recurring_house_cleaning: "text-emerald-600 dark:text-emerald-300",
  deep_clean: "text-amber-600 dark:text-amber-300",
};

export function calendarServiceIconTone(serviceType: ServiceTypeKey): string {
  return ICON_TONE[normalizeServiceType(serviceType)] ?? "text-muted-foreground";
}

export function CalendarServiceIcon({
  serviceType,
  className,
}: {
  serviceType: ServiceTypeKey;
  className?: string;
}) {
  const k = normalizeServiceType(serviceType);
  const Icon = ICON_MAP[k] ?? Sparkles;
  return <Icon className={cn(calendarServiceIconTone(k), className)} aria-hidden />;
}

export function calendarChipBorderClass(serviceType: ServiceTypeKey): string {
  const k = normalizeServiceType(serviceType);
  const dot = CALENDAR_EVENT_DOT_CLASS[k] ?? "bg-muted-foreground";
  if (dot.includes("violet")) return "border-violet-500/40 dark:border-violet-400/35";
  if (dot.includes("sky")) return "border-sky-500/40 dark:border-sky-400/35";
  if (dot.includes("emerald")) return "border-emerald-500/40 dark:border-emerald-400/35";
  if (dot.includes("amber")) return "border-amber-500/40 dark:border-amber-400/35";
  return "border-border";
}

/**
 * Calendar legend: coloured border + `CalendarServiceIcon` (no dot). Use on job/listing overview cards
 * to match the calendar’s service-type cues.
 */
export function ServiceTypeCalendarLegendMark({
  serviceType,
  className,
  iconClassName,
  title: titleOverride,
}: {
  serviceType: string | null | undefined;
  className?: string;
  iconClassName?: string;
  title?: string;
}) {
  const k = normalizeServiceType(serviceType);
  const label = titleOverride ?? CALENDAR_EVENT_LEGEND_LABEL[k] ?? "Service type";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border bg-background/90 p-1 shadow-sm dark:bg-gray-950/80",
        calendarChipBorderClass(k),
        className
      )}
      title={label}
    >
      <CalendarServiceIcon serviceType={k} className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", iconClassName)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
