import { format, parse, parseISO, subDays } from "date-fns";

export const DISPLAY_DATE_FMT = "dd/MM/yyyy";

/** Parse YYYY-MM-DD (and similar date-only strings) in local calendar time. */
export function parseListingCalendarDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const t = raw.trim().slice(0, 10);
  const d = parse(t, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateDdMmYyyy(date: Date): string {
  return format(date, DISPLAY_DATE_FMT);
}

/** Fixed pattern so SSR and browser match (avoid `toLocaleString(undefined, …)` hydration mismatches). */
export function formatEndDateTime(iso: string): string {
  try {
    let d = parseISO(iso);
    if (Number.isNaN(d.getTime())) {
      d = new Date(iso);
    }
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "EEE, d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
}

export function humanizePropertyCondition(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const map: Record<string, string> = {
    excellent_very_good: "Excellent / very good",
    good: "Good",
    fair_average: "Fair / average",
    poor_bad: "Poor / bad",
  };
  return map[raw] ?? raw.replace(/_/g, " ");
}

/** Listing detail: show preferred window as 5 days before move-out when move-out is known. */
export function preferredWindowFromMoveOutDate(moveOutDate: Date | null): string | null {
  if (moveOutDate == null) return null;
  return formatDateDdMmYyyy(subDays(moveOutDate, 5));
}
