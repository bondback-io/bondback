import { format, parse, subDays } from "date-fns";
import { parseUtcTimestamp } from "@/lib/utils";

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

/**
 * Formats listing auction `end_time` in the **current environment's local timezone**
 * (same instant as `parseUtcTimestamp` / `CountdownTimer`).
 *
 * Use inside client components after mount (e.g. `ListingEndsAtLocal`) so the label matches
 * the viewer's device; avoid calling during SSR if the server TZ differs from the user.
 */
export function formatEndDateTime(iso: string): string {
  try {
    const ms = parseUtcTimestamp(iso);
    if (!Number.isFinite(ms)) return String(iso ?? "").trim() || "—";
    return format(new Date(ms), "EEE, d MMM yyyy, h:mm a");
  } catch {
    return String(iso ?? "").trim() || "—";
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

/**
 * Legacy `listings.description` sometimes bundled "Property address: …", duplicated "Special areas: …",
 * or free text. Strip machine-prefixed lines for display; prefer `property_description` on new rows.
 */
export function listingDescriptionForDisplay(raw: string | null | undefined): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  for (let i = 0; i < 6; i++) {
    const next = s
      .replace(/(^|\n\n)Special areas:\s*.+?\.\s*/is, "$1")
      .replace(/^\s*Special areas:\s*.+?\.\s*/is, "")
      .replace(/(^|\n)\s*Property address:\s*[^\n]*/gi, "$1")
      .replace(/^\s*Property address:\s*[^\n]*/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

export type ListingNarrativeFields = {
  property_description?: string | null;
  description?: string | null;
};

/** Body text for "Property description" in listing/job detail (new column, else cleaned legacy `description`). */
export function listingPropertyDescriptionBody(listing: ListingNarrativeFields): string {
  const pd = (listing.property_description ?? "").trim();
  if (pd) return pd;
  return listingDescriptionForDisplay(listing.description ?? "");
}

/** Plain narrative for meta / JSON-LD (same resolution as detail body). */
export function listingNarrativeForSeo(listing: ListingNarrativeFields): string {
  return listingPropertyDescriptionBody(listing);
}
