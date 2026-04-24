/**
 * Optional JSON on `listings.service_details` — extra fields for non–bond-clean flows.
 * Versioned so we can evolve without breaking older rows.
 */

import { format, parseISO, isValid } from "date-fns";
import type { ListingRow } from "@/lib/listings";
import {
  deepCleanPurposeLabel,
  normalizeServiceType,
  recurringFrequencyShortLabel,
  type ServiceTypeKey,
} from "@/lib/service-types";

export const LISTING_SERVICE_DETAILS_VERSION = 1 as const;

export type DeepCleanIntensityKey = "light" | "standard" | "heavy";

export const DEEP_FOCUS_AREA_KEYS = [
  "inside_cupboards",
  "behind_appliances",
  "high_dusting",
  "oven_rangehood",
  "windows",
  "fridge",
  "walls",
  "floors",
] as const;

export type DeepFocusAreaKey = (typeof DEEP_FOCUS_AREA_KEYS)[number];

export type ListingServiceDetailsV1 = {
  v: typeof LISTING_SERVICE_DETAILS_VERSION;
  access_instructions?: string | null;
  airbnb_host_notes?: string | null;
  recurring_preferred_schedule?: string | null;
  recurring_focus_notes?: string | null;
  deep_clean_intensity?: DeepCleanIntensityKey | null;
  deep_focus_areas?: string[] | null;
  deep_special_requests?: string | null;
};

export function deepFocusAreaLabel(key: string): string {
  switch (key) {
    case "inside_cupboards":
      return "Inside cupboards";
    case "behind_appliances":
      return "Behind appliances";
    case "high_dusting":
      return "High dusting";
    case "oven_rangehood":
      return "Oven / rangehood";
    case "windows":
      return "Windows";
    case "fridge":
      return "Fridge";
    case "walls":
      return "Walls";
    case "floors":
      return "Floors";
    default:
      return key.replace(/_/g, " ");
  }
}

export function deepCleanIntensityLabel(k: string | null | undefined): string {
  switch (String(k ?? "").toLowerCase()) {
    case "light":
      return "Light deep clean";
    case "standard":
      return "Standard deep clean";
    case "heavy":
      return "Heavy deep clean";
    default:
      return "";
  }
}

export function parseListingServiceDetails(raw: unknown): ListingServiceDetailsV1 | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.v) !== LISTING_SERVICE_DETAILS_VERSION) return null;
  const intensity = o.deep_clean_intensity;
  const validIntensity =
    intensity === "light" || intensity === "standard" || intensity === "heavy" ? intensity : null;
  const areasRaw = o.deep_focus_areas;
  const deep_focus_areas = Array.isArray(areasRaw)
    ? areasRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
    : null;
  return {
    v: LISTING_SERVICE_DETAILS_VERSION,
    access_instructions: typeof o.access_instructions === "string" ? o.access_instructions : null,
    airbnb_host_notes: typeof o.airbnb_host_notes === "string" ? o.airbnb_host_notes : null,
    recurring_preferred_schedule:
      typeof o.recurring_preferred_schedule === "string" ? o.recurring_preferred_schedule : null,
    recurring_focus_notes:
      typeof o.recurring_focus_notes === "string" ? o.recurring_focus_notes : null,
    deep_clean_intensity: validIntensity,
    deep_focus_areas,
    deep_special_requests:
      typeof o.deep_special_requests === "string" ? o.deep_special_requests : null,
  };
}

/** Build JSON for insert/update (only defined keys). */
export function buildListingServiceDetailsPayload(
  partial: Partial<Omit<ListingServiceDetailsV1, "v">> & { v?: number }
): Record<string, unknown> {
  const out: Record<string, unknown> = { v: LISTING_SERVICE_DETAILS_VERSION };
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "") return;
    out[k] = v;
  };
  set("access_instructions", partial.access_instructions?.trim() || null);
  set("airbnb_host_notes", partial.airbnb_host_notes?.trim() || null);
  set("recurring_preferred_schedule", partial.recurring_preferred_schedule?.trim() || null);
  set("recurring_focus_notes", partial.recurring_focus_notes?.trim() || null);
  if (
    partial.deep_clean_intensity === "light" ||
    partial.deep_clean_intensity === "standard" ||
    partial.deep_clean_intensity === "heavy"
  ) {
    out.deep_clean_intensity = partial.deep_clean_intensity;
  }
  if (Array.isArray(partial.deep_focus_areas) && partial.deep_focus_areas.length > 0) {
    out.deep_focus_areas = partial.deep_focus_areas;
  }
  set("deep_special_requests", partial.deep_special_requests?.trim() || null);
  return out;
}

export type ListingCardServiceUi = {
  badgeLabel: string;
  badgeClassName: string;
  /** Optional accent (border) on cards */
  cardAccentClassName: string;
  /** Secondary line under title — checkout, recurring info, deep intensity, etc. */
  highlightLine: string | null;
};

/** Coloured badge + one highlight line for marketplace / dashboard cards. */
export function getListingCardServiceUi(listing: ListingRow): ListingCardServiceUi {
  const svc = normalizeServiceType(
    (listing as { service_type?: string | null }).service_type
  );
  const details = parseListingServiceDetails(
    (listing as { service_details?: unknown }).service_details
  );

  const badgeLabel = serviceTypeBadgeShortLabel(svc);
  const badgeClassName = serviceTypeBadgeClassName(svc);
  const cardAccentClassName = serviceTypeCardAccentClassName(svc);

  let highlightLine: string | null = null;

  if (svc === "bond_cleaning") {
    const parts: string[] = [];
    const d = listing.move_out_date ? parseISO(String(listing.move_out_date)) : null;
    if (d && isValid(d)) {
      parts.push(`Move-out ${format(d, "d MMM yyyy")}`);
    }
    const areas = Array.isArray(listing.special_areas)
      ? listing.special_areas.filter((a): a is string => typeof a === "string" && a.length > 0)
      : [];
    if (areas.length > 0) {
      parts.push(`${areas.length} special area${areas.length === 1 ? "" : "s"}`);
    }
    highlightLine = parts.length > 0 ? parts.join(" · ") : null;
  } else if (svc === "airbnb_turnover") {
    const d = listing.move_out_date ? parseISO(String(listing.move_out_date)) : null;
    if (d && isValid(d)) {
      highlightLine = `Check-out ${format(d, "d MMM yyyy")}`;
    }
  } else if (svc === "recurring_house_cleaning") {
    const freq = recurringFrequencyShortLabel(
      (listing as { recurring_frequency?: string | null }).recurring_frequency
    );
    const sched = details?.recurring_preferred_schedule?.trim();
    const lr = listing as {
      recurring_next_occurrence_on?: string | null;
      recurring_contract_paused?: boolean | null;
      recurring_series_start_date?: string | null;
    };
    const parts: string[] = [];
    if (freq) parts.push(freq);
    if (sched) parts.push(sched);
    const nextSource =
      lr.recurring_next_occurrence_on ??
      listing.move_out_date ??
      lr.recurring_series_start_date ??
      null;
    const nextD = nextSource ? parseISO(String(nextSource)) : null;
    if (nextD && isValid(nextD)) {
      parts.push(`Next: ${format(nextD, "d MMM yyyy")}`);
    } else if (Array.isArray(listing.preferred_dates) && listing.preferred_dates.length > 0) {
      const first = parseISO(String(listing.preferred_dates[0]));
      if (isValid(first)) parts.push(`Preferred: ${format(first, "d MMM yyyy")}`);
    }
    parts.push(lr.recurring_contract_paused === true ? "Paused" : "Active");
    highlightLine = parts.length > 0 ? parts.join(" · ") : freq || null;
  } else if (svc === "deep_clean") {
    const inten = deepCleanIntensityLabel(details?.deep_clean_intensity);
    const purpose = deepCleanPurposeLabel(
      (listing as { deep_clean_purpose?: string | null }).deep_clean_purpose
    );
    const areas = (details?.deep_focus_areas ?? [])
      .map((k) => deepFocusAreaLabel(k))
      .filter(Boolean);
    const head = [inten, purpose].filter(Boolean).join(" · ");
    const tail = areas.length > 0 ? areas.slice(0, 3).join(", ") + (areas.length > 3 ? "…" : "") : "";
    highlightLine = [head, tail].filter(Boolean).join(" — ") || null;
  }

  return { badgeLabel, badgeClassName, cardAccentClassName, highlightLine };
}

function serviceTypeBadgeShortLabel(svc: ServiceTypeKey): string {
  switch (svc) {
    case "bond_cleaning":
      return "Bond clean";
    case "airbnb_turnover":
      return "Airbnb turnover";
    case "recurring_house_cleaning":
      return "Recurring";
    case "deep_clean":
      return "Deep clean";
    default:
      return "Cleaning";
  }
}

function serviceTypeBadgeClassName(svc: ServiceTypeKey): string {
  switch (svc) {
    case "bond_cleaning":
      return "border-orange-300/80 bg-orange-100 text-orange-950 shadow-sm dark:border-orange-700/60 dark:bg-orange-950/70 dark:text-orange-100";
    case "airbnb_turnover":
      return "border-teal-300/80 bg-teal-100 text-teal-950 shadow-sm dark:border-teal-700/60 dark:bg-teal-950/70 dark:text-teal-100";
    case "recurring_house_cleaning":
      return "border-sky-300/80 bg-sky-100 text-sky-950 shadow-sm dark:border-sky-700/60 dark:bg-sky-950/70 dark:text-sky-100";
    case "deep_clean":
      return "border-violet-300/80 bg-violet-100 text-violet-950 shadow-sm dark:border-violet-700/60 dark:bg-violet-950/70 dark:text-violet-100";
    default:
      return "border-border bg-muted text-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
  }
}

function serviceTypeCardAccentClassName(svc: ServiceTypeKey): string {
  switch (svc) {
    case "bond_cleaning":
      return "ring-1 ring-orange-500/15 dark:ring-orange-400/10";
    case "airbnb_turnover":
      return "ring-1 ring-teal-500/15 dark:ring-teal-400/10";
    case "recurring_house_cleaning":
      return "ring-1 ring-sky-500/15 dark:ring-sky-400/10";
    case "deep_clean":
      return "ring-1 ring-violet-500/15 dark:ring-violet-400/10";
    default:
      return "";
  }
}
