"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { createNotification } from "@/lib/actions/notifications";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { parseUtcTimestamp } from "@/lib/utils";
import { MAX_BID_DROP_PER_BID_CENTS } from "@/lib/bidding-rules";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type BidRow = Database["public"]["Tables"]["bids"]["Row"];

/**
 * Job detail URLs use `/jobs/[id]` where `id` may be a listing id or a job id
 * (see `app/jobs/[id]/page.tsx`). Revalidate both so `router.refresh()` sees new bids.
 */
async function revalidateJobDetailPagesForListing(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  listingId: string
) {
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${listingId}`);
  const { data: jobRows } = await supabase
    .from("jobs")
    .select("id")
    .eq("listing_id", listingId);
  for (const r of jobRows ?? []) {
    const jid = (r as { id: unknown }).id;
    if (jid != null && String(jid).length > 0) {
      revalidatePath(`/jobs/${jid}`);
    }
  }
}

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function formatAudFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** One-time bypass for “wait for another cleaner” after revert/cancel last bid (value = user id). */
function bidAllowAfterRevertCookieName(listingId: string): string {
  return `bb_bid_allow_${listingId}`;
}

/** Prefer service role so listing updates succeed even when RLS blocks cleaner updates. */
async function setListingCurrentLowest(
  listingId: string,
  cents: number,
  userClient: SupabaseServer
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const payload = { current_lowest_bid_cents: cents } as never;
  if (admin) {
    const { error } = await admin.from("listings").update(payload).eq("id", listingId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error } = await userClient.from("listings").update(payload).eq("id", listingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Delete a bid row. Many projects only grant INSERT/SELECT on `bids` (no DELETE RLS),
 * so we use the service role when available. Caller must only pass a bid id already
 * verified as belonging to the current user.
 */
async function deleteBidRow(
  bidId: string,
  userClient: SupabaseServer
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { error } = await admin.from("bids").delete().eq("id", bidId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error, data } = await userClient
    .from("bids")
    .delete()
    .eq("id", bidId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return {
      ok: false,
      error:
        "Could not remove bid. Add a DELETE policy for own bids on `bids`, or set SUPABASE_SERVICE_ROLE_KEY on the server.",
    };
  }
  return { ok: true };
}

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

  const { data: minBidRow } = await supabase
    .from("bids")
    .select("amount_cents")
    .eq("listing_id", listingId)
    .order("amount_cents", { ascending: true })
    .limit(1)
    .maybeSingle();

  const effectiveLowest =
    minBidRow != null
      ? (minBidRow as { amount_cents: number }).amount_cents
      : row.starting_price_cents;

  const { data: lastBidRow } = await supabase
    .from("bids")
    .select("cleaner_id")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cookieStore = await cookies();
  const allowCookieName = bidAllowAfterRevertCookieName(listingId);
  const allowAfterRevert =
    cookieStore.get(allowCookieName)?.value === session.user.id;

  if (
    lastBidRow &&
    (lastBidRow as { cleaner_id: string }).cleaner_id === session.user.id
  ) {
    if (allowAfterRevert) {
      cookieStore.delete(allowCookieName);
    } else {
      return {
        ok: false,
        error:
          "Wait for another cleaner to place a bid before you can bid again (reduces spam bidding).",
      };
    }
  } else if (allowAfterRevert) {
    cookieStore.delete(allowCookieName);
  }

  const { data: dupBid } = await supabase
    .from("bids")
    .select("id")
    .eq("listing_id", listingId)
    .eq("cleaner_id", session.user.id)
    .eq("amount_cents", amountCents)
    .limit(1)
    .maybeSingle();

  if (dupBid) {
    return {
      ok: false,
      error: "You already placed a bid at this amount. Enter a different price.",
    };
  }

  if (amountCents >= effectiveLowest) {
    return {
      ok: false,
      error: `Your bid must be lower than ${formatAudFromCents(effectiveLowest)}.`,
    };
  }

  const minAllowedCents = effectiveLowest - MAX_BID_DROP_PER_BID_CENTS;
  if (amountCents < minAllowedCents) {
    return {
      ok: false,
      error: `Each bid can lower the price by at most $${(MAX_BID_DROP_PER_BID_CENTS / 100).toFixed(0)} in one step. Bid between ${formatAudFromCents(Math.max(1, minAllowedCents))} and ${formatAudFromCents(effectiveLowest - 1)}.`,
    };
  }

  const bidAmount = amountCents / 100;

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return { ok: false, error: "Bid amount must be greater than $0" };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("bids")
    .insert(
      {
        listing_id: listingId,
        bidder_id: session.user.id,
        cleaner_id: session.user.id,
        amount: bidAmount,
        amount_cents: amountCents,
        status: "active",
      } as never
    )
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Could not place bid." };
  }

  const bidId = (inserted as { id: string }).id;
  const upd = await setListingCurrentLowest(listingId, amountCents, supabase);
  if (!upd.ok) {
    await deleteBidRow(bidId, supabase);
    return {
      ok: false,
      error: `${upd.error} If this persists, set SUPABASE_SERVICE_ROLE_KEY on the server so listing prices can update.`,
    };
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

  await revalidateJobDetailPagesForListing(supabase, listingId);
  revalidatePath("/my-listings");
  revalidatePath("/cleaner/dashboard");
  revalidatePath("/lister/dashboard");
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

  const del = await deleteBidRow(String(bid.id), supabase);
  if (!del.ok) {
    return { ok: false, error: del.error };
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
    const upd = await setListingCurrentLowest(listingId, newLowest, supabase);
    if (!upd.ok) {
      return { ok: false, error: upd.error };
    }
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(bidAllowAfterRevertCookieName(listingId), session.user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 15,
      path: "/",
    });
  } catch {
    // Some Next.js runtimes restrict mutating cookies in server actions; revert still succeeded.
  }

  await revalidateJobDetailPagesForListing(supabase, listingId);
  revalidatePath("/my-listings");
  revalidatePath("/cleaner/dashboard");
  revalidatePath("/lister/dashboard");
  return { ok: true };
}
