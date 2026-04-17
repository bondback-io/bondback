"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BID_FULL_SELECT } from "@/lib/supabase/queries";
import { enrichBidsWithBidderProfiles } from "@/lib/bids/enrich-bids-with-bidders";
import type { BidWithBidder } from "@/components/features/bid-history-table";

/** Bids + bidder summaries for the Find Jobs inline detail panel (same shape as listing page). */
export async function fetchListingBidsForFindJobsPanel(
  listingId: string
): Promise<BidWithBidder[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("bids")
    .select(BID_FULL_SELECT)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[fetchListingBidsForFindJobsPanel]", error.message);
    return [];
  }
  return (await enrichBidsWithBidderProfiles(data ?? [])) as BidWithBidder[];
}
