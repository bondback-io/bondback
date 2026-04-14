import type { Database } from "@/types/supabase";
import { isListingLive } from "@/lib/listings";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/**
 * Public Q&A is shown only while the listing is open for bidding (no active job yet).
 * Supports `status` values `live` (auction clock) and `bidding` if used in future.
 */
export function shouldShowPublicListingComments(
  listing: ListingRow,
  hasActiveJob: boolean
): boolean {
  if (hasActiveJob) return false;
  if (listing.cancelled_early_at != null) return false;
  const st = String(listing.status ?? "").toLowerCase();
  if (st === "bidding") return true;
  if (st !== "live") return false;
  return isListingLive(listing);
}
