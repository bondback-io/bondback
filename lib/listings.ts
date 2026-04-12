import type { Database } from "@/types/supabase";
import { parseUtcTimestamp } from "@/lib/utils";

export type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
export type BidRow = Database["public"]["Tables"]["bids"]["Row"];
export type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function isListingLive(row: ListingRow): boolean {
  return row.status === "live" && parseUtcTimestamp(row.end_time) > Date.now();
}

/**
 * Listing IDs that have a cancelled job — the listing row may still be `status: live`
 * (job cancel does not always flip listing status). These must not appear as "active live"
 * on lister dashboards / Find Jobs style views.
 */
export function listingIdsWithCancelledJobs(
  jobs: ReadonlyArray<{ listing_id: string | number; status: string | null | undefined }>
): Set<string> {
  return new Set(
    jobs
      .filter((j) => String(j.status ?? "").toLowerCase() === "cancelled")
      .map((j) => String(j.listing_id))
  );
}

/** Listing-like shape for cover URL (supports Row or partial). */
export type ListingWithPhotos = {
  cover_photo_url?: string | null;
  initial_photos?: string[] | null;
  photo_urls?: string[] | null;
};

/**
 * Normalize `initial_photos` / `photo_urls` from Postgres `text[]`, JSON string, or plain array.
 */
export function normalizeListingPhotoUrlArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u) => u.trim());
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
            .map((u) => u.trim());
        }
      } catch {
        return [];
      }
    }
  }
  return [];
}

/**
 * All distinct listing image URLs from DB: cover (when it matches gallery or is the only source),
 * then initial_photos, then photo_urls (deduped in order).
 *
 * If `cover_photo_url` points at a removed/orphan URL (not in initial_photos/photo_urls) but the
 * gallery still has photos, we **skip** the orphan so cards don’t prefer a broken first URL.
 */
export function collectListingPhotoUrls(listing: ListingWithPhotos): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const push = (u: string) => {
    const s = u.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    urls.push(s);
  };

  const initialArr = normalizeListingPhotoUrlArray(listing.initial_photos);
  const urlsArr = normalizeListingPhotoUrlArray(listing.photo_urls);
  const gallery = [...initialArr, ...urlsArr];

  const cover =
    typeof listing.cover_photo_url === "string" ? listing.cover_photo_url.trim() : "";

  if (cover) {
    if (gallery.length === 0) {
      push(cover);
    } else if (gallery.includes(cover)) {
      push(cover);
    }
    /** else: orphan cover — omit; gallery URLs follow */
  }

  initialArr.forEach(push);
  urlsArr.forEach(push);
  return urls;
}

/** Merge ordered URL lists, skipping duplicates (later lists only add new URLs). */
export function mergePhotoUrlLists(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (u: string) => {
    const s = u.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  primary.forEach(add);
  secondary.forEach(add);
  return out;
}

/** Put the lister's chosen cover URL first when it appears in the list (hero + gallery order). */
export function orderCoverPhotoFirst(
  urls: string[],
  cover: string | null | undefined
): string[] {
  if (!cover?.trim()) return urls;
  const c = cover.trim();
  if (!urls.includes(c)) {
    /** Orphan cover not in merged list — don’t force a broken URL to the front */
    return urls;
  }
  const rest = urls.filter((u) => u !== c);
  return [c, ...rest];
}

/**
 * Returns the URL to use as the listing card/cover image.
 * Uses the same ordered list as {@link collectListingPhotoUrls} (skips orphan `cover_photo_url`).
 */
export function getListingCoverUrl(listing: ListingWithPhotos | null | undefined): string | null {
  if (!listing) return null;
  const urls = collectListingPhotoUrls(listing);
  return urls[0] ?? null;
}

/**
 * Second distinct photo for card strips (e.g. before/after preview). Skips the same URL as the cover.
 */
export function getListingSecondImageUrl(listing: ListingWithPhotos | null | undefined): string | null {
  if (!listing) return null;
  const all = collectListingPhotoUrls(listing);
  return all[1] ?? null;
}

/** Listing row may include `preferred_dates` (not always in generated DB types). */
export type ListingWithPreferredDates = ListingRow & {
  preferred_dates?: string[] | null;
};

/**
 * End of the preferred cleaning window: latest preferred date, or move-out date if none.
 * Used for "due soon" / overdue relative to what the lister asked for.
 */
export function getPreferredCleaningDeadlineMs(
  listing: ListingWithPreferredDates | null
): number | null {
  if (!listing) return null;
  const rawPreferred = listing.preferred_dates;
  if (Array.isArray(rawPreferred) && rawPreferred.length > 0) {
    const times = rawPreferred
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));
    if (times.length === 0) return null;
    return Math.max(...times);
  }
  const mov = listing.move_out_date;
  if (mov) {
    const t = new Date(mov).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Whole days until the preferred cleaning deadline. Negative means overdue (past end of window).
 */
export function daysUntilPreferredCleaningDeadline(
  deadlineMs: number,
  now: Date = new Date()
): number {
  return Math.ceil((deadlineMs - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** Short label for dashboards (supports negative days = overdue). */
export function formatPreferredCleaningDueLine(daysLeft: number | null): string | null {
  if (daysLeft == null) return null;
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    return n === 1 ? "1 day overdue" : `${n} days overdue`;
  }
  if (daysLeft === 0) return "Due today";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/**
 * Payload for `createListingForPublish` / `buildListingInsertRow`.
 * Extends generated `Insert` with columns that exist in production DB but may be missing from regenerated types.
 */
export type ListingInsertPayload = ListingInsert & {
  /** Date part of auction end — required when `listings.end_date` is NOT NULL in Postgres. */
  end_date?: string;
  reserve_price?: number;
  base_price?: number;
};

/**
 * `duration_days === 0` means a 2-minute test auction (only when global_settings.allow_two_minute_auction_test is on).
 * Otherwise use 1, 3, 5, or 7.
 */
export const AUCTION_DURATION_TWO_MINUTE_SENTINEL_DAYS = 0;

export function computeListingEndTimeIso(params: {
  durationDays: number;
  nowMs?: number;
}): string {
  const now = params.nowMs ?? Date.now();
  if (params.durationDays === AUCTION_DURATION_TWO_MINUTE_SENTINEL_DAYS) {
    return new Date(now + 2 * 60 * 1000).toISOString();
  }
  return new Date(now + params.durationDays * 24 * 60 * 60 * 1000).toISOString();
}

/** Milliseconds for a fresh timer when relisting an expired auction. */
export function relistDurationMsFromDurationDays(durationDays: number | null | undefined): number {
  if (durationDays == null || Number.isNaN(Number(durationDays))) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const raw = Number(durationDays);
  if (raw === AUCTION_DURATION_TWO_MINUTE_SENTINEL_DAYS) {
    return 2 * 60 * 1000;
  }
  const d = raw > 0 ? raw : 7;
  return d * 24 * 60 * 60 * 1000;
}

/**
 * Build the row to insert into public.listings (Supabase).
 * Column names must match the table exactly (snake_case). See docs/LISTINGS_TABLE_SCHEMA.md.
 */
export function buildListingInsertRow(params: {
  lister_id: string;
  title: string;
  description: string | null;
  property_address: string | null;
  suburb: string;
  postcode: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  addons: string[];
  special_instructions: string | null;
  move_out_date: string;
  photo_urls: string[] | null;
  reserve_cents: number;
  reserve_price: number;
  buy_now_cents: number | null;
  base_price: number;
  starting_price_cents: number;
  current_lowest_bid_cents: number;
  duration_days: number;
  status: string;
  end_time: string;
  end_date: string;
  /** Admin global % at publish time — frozen on the listing row. */
  platform_fee_percentage: number;
  preferred_dates?: string[] | null;
  initial_photos?: string[] | null;
  property_condition: string | null;
  property_levels: string | null;
}): ListingInsertPayload {
  const addr = params.property_address?.trim();
  const descParts = [addr ? `Property address: ${addr}` : null, params.description?.trim() || null].filter(
    Boolean
  ) as string[];
  const description = descParts.length > 0 ? descParts.join("\n\n") : null;

  return {
    lister_id: params.lister_id,
    title: params.title,
    description,
    suburb: params.suburb,
    postcode: params.postcode,
    property_type: params.property_type,
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
    addons: params.addons.length > 0 ? params.addons : null,
    special_instructions: params.special_instructions,
    move_out_date: params.move_out_date,
    photo_urls: params.photo_urls,
    reserve_cents: params.reserve_cents,
    buy_now_cents: params.buy_now_cents,
    starting_price_cents: params.starting_price_cents,
    current_lowest_bid_cents: params.current_lowest_bid_cents,
    duration_days: params.duration_days,
    status: params.status,
    end_time: params.end_time,
    end_date: params.end_date,
    reserve_price: params.reserve_price,
    base_price: params.base_price,
    platform_fee_percentage: params.platform_fee_percentage,
    preferred_dates: params.preferred_dates ?? null,
    property_condition: params.property_condition,
    property_levels: params.property_levels,
  };
}
