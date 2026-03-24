"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { createNotification } from "@/lib/actions/notifications";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { parseUtcTimestamp } from "@/lib/utils";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type BidRow = Database["public"]["Tables"]["bids"]["Row"];

export type PlaceBidResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Place a lower bid on a live listing. Caller must be a cleaner; bid must be
 * strictly less than current_lowest_bid_cents. Server enforces end_time (no bid after end).
 */
export async function placeBid(
  listingId: string,
  amountCents: number
): Promise<PlaceBidResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in to bid." };
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData as { roles: string[] | null; active_role: string | null } | null;
  const roles = (profile?.roles ?? []) as string[];
  const activeRole = profile?.active_role ?? (roles[0] ?? null);

  if (!roles.includes("cleaner") || activeRole !== "cleaner") {
    return { ok: false, error: "Only cleaners can place bids." };
  }

  const settings = await getGlobalSettings();
  if (settings?.require_stripe_connect_before_bidding !== false) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("stripe_connect_id, stripe_onboarding_complete")
      .eq("id", session.user.id)
      .maybeSingle();
    const pr = profileRow as { stripe_connect_id?: string | null; stripe_onboarding_complete?: boolean } | null;
    if (!pr?.stripe_connect_id?.trim() || pr?.stripe_onboarding_complete !== true) {
      return {
        ok: false,
        error: "Please connect your bank account to receive payment. Go to Profile or Settings to connect.",
      };
    }
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const row = listing as ListingRow;
  if (row.status !== "live") {
    return { ok: false, error: "This auction is no longer live." };
  }

  const nowMs = Date.now();
  if (parseUtcTimestamp(row.end_time) <= nowMs) {
    return { ok: false, error: "This auction has ended." };
  }

  if (amountCents >= row.current_lowest_bid_cents) {
    return {
      ok: false,
      error: `Your bid must be lower than $${(row.current_lowest_bid_cents / 100).toFixed(2)}.`
    };
  }

  const bidAmount = amountCents / 100;

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return { ok: false, error: "Bid amount must be greater than $0" };
  }

  const { error: insertError } = await supabase.from("bids").insert(
    {
      listing_id: listingId,
      bidder_id: session.user.id,
      cleaner_id: session.user.id,
      amount: bidAmount,
      amount_cents: amountCents,
      status: "active",
    } as never
  );

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ current_lowest_bid_cents: amountCents } as never)
    .eq("id", listingId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (row.lister_id) {
    await createNotification(
      row.lister_id,
      "new_bid",
      null,
      `New bid of $${bidAmount.toFixed(2)} on your listing.`,
      { listingId: Number(listingId) }
    );
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/cleaner/dashboard");
  return { ok: true };
}

export type CancelLastBidResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Cancel the most recent active bid for this listing by the current cleaner.
 */
export async function cancelLastBid(
  listingId: string
): Promise<CancelLastBidResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in to cancel a bid." };
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData as {
    roles: string[] | null;
    active_role: string | null;
  } | null;
  const roles = (profile?.roles ?? []) as string[];
  const activeRole = profile?.active_role ?? (roles[0] ?? null);

  if (!roles.includes("cleaner") || activeRole !== "cleaner") {
    return { ok: false, error: "Only cleaners can cancel bids." };
  }

  // Find latest bid for this cleaner on the listing
  const { data: bids, error: fetchError } = await supabase
    .from("bids")
    .select("*")
    .eq("listing_id", listingId)
    .eq("cleaner_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  const bid = (bids ?? [])[0] as BidRow | undefined;
  if (!bid) {
    return { ok: false, error: "No bid to cancel." };
  }

  const { error: deleteError } = await supabase
    .from("bids")
    .delete()
    .eq("id", bid.id);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  // Recompute current_lowest_bid_cents from remaining bids for this listing
  const { data: remainingBids, error: remainingError } = await supabase
    .from("bids")
    .select("amount_cents")
    .eq("listing_id", listingId)
    .order("amount_cents", { ascending: true });

  if (remainingError) {
    return { ok: false, error: remainingError.message };
  }

  let newLowest: number | null = null;
  if (remainingBids && remainingBids.length > 0) {
    newLowest = (remainingBids[0] as any).amount_cents as number;
  } else {
    // Fallback to starting price if no active bids left
    const { data: listing } = await supabase
      .from("listings")
      .select("starting_price_cents")
      .eq("id", listingId)
      .maybeSingle();
    newLowest = (listing as any)?.starting_price_cents ?? null;
  }

  if (newLowest != null) {
    await supabase
      .from("listings")
      .update({ current_lowest_bid_cents: newLowest } as never)
      .eq("id", listingId);
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/cleaner/dashboard");
  return { ok: true };
}
