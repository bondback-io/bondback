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
type ListingWithPhotos = {
  cover_photo_url?: string | null;
  initial_photos?: string[] | null;
  photo_urls?: string[] | null;
};

/**
 * Returns the URL to use as the listing card/cover image.
 * Prefers cover_photo_url (default photo), then first initial_photo, then first photo_url.
 */
export function getListingCoverUrl(listing: ListingWithPhotos | null | undefined): string | null {
  if (!listing) return null;
  const cover = listing.cover_photo_url;
  if (typeof cover === "string" && cover.trim()) return cover;
  const initial = Array.isArray(listing.initial_photos) ? listing.initial_photos[0] : null;
  if (typeof initial === "string" && initial.trim()) return initial;
  const urls = Array.isArray(listing.photo_urls) ? listing.photo_urls : [];
  const first = urls[0];
  return typeof first === "string" && first.trim() ? first : null;
}

/** Insert payload may include columns not in generated types (e.g. reserve_price, base_price, end_date). */
export type ListingInsertPayload = ListingInsert & {
  reserve_price?: number;
  base_price?: number;
  end_date?: string;
  preferred_dates?: string[] | null;
  initial_photos?: string[] | null;
  property_address?: string | null;
};

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
}): ListingInsertPayload {
  return {
    lister_id: params.lister_id,
    title: params.title,
    description: params.description,
    suburb: params.suburb,
    postcode: params.postcode,
    property_address: params.property_address ?? null,
    property_type: params.property_type,
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
    addons: params.addons.length > 0 ? params.addons : null,
    special_instructions: params.special_instructions,
    move_out_date: params.move_out_date,
    photo_urls: params.photo_urls,
    reserve_cents: params.reserve_cents,
    reserve_price: params.reserve_price,
    buy_now_cents: params.buy_now_cents,
    base_price: params.base_price,
    starting_price_cents: params.starting_price_cents,
    current_lowest_bid_cents: params.current_lowest_bid_cents,
    duration_days: params.duration_days,
    status: params.status,
    end_time: params.end_time,
    end_date: params.end_date,
    platform_fee_percentage: params.platform_fee_percentage,
    preferred_dates: params.preferred_dates ?? null,
    // initial_photos are set in a second step via updateListingInitialPhotos (not sent on insert so DB without column still works)
  };
}
