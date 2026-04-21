"use server";

import { revalidatePath } from "next/cache";
import { finalizeBidAcceptanceCore } from "@/lib/actions/jobs";
import { createNotification } from "@/lib/actions/notifications";
import { revalidateJobsBrowseCaches } from "@/lib/cache-revalidate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimStr } from "@/lib/utils";

export type ResolveAuctionsResult = {
  processed: number;
  jobsCreated: number;
  expiredNoBids: number;
  endedWithoutJob: number;
  errors: string[];
};

type ResolveFilter = { listingId?: string };

/**
 * Closes live listings whose `end_time` has passed: assigns the lowest **active** bid to a new job
 * (same path as lister “Accept bid”), or sets `expired` when there were no bids, or `ended` when
 * bids exist but none are active (edge case) or assignment fails.
 *
 * **Concurrency:** `applyListingAuctionOutcomes`, the listing countdown (`resolveAuctionEndForListing`),
 * and cron can run this for the same listing at once. Job creation uses a DB unique index + insert
 * conflict handling in {@link finalizeBidAcceptanceCore} so only one non-cancelled job per listing exists.
 */
export async function resolveExpiredLiveAuctions(
  filter?: ResolveFilter
): Promise<ResolveAuctionsResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      processed: 0,
      jobsCreated: 0,
      expiredNoBids: 0,
      endedWithoutJob: 0,
      errors: ["SUPABASE_SERVICE_ROLE_KEY not configured"],
    };
  }

  const nowIso = new Date().toISOString();
  let q = admin
    .from("listings")
    .select("id, lister_id, title")
    .eq("status", "live")
    .is("cancelled_early_at", null)
    .lt("end_time", nowIso);

  const lid = trimStr(filter?.listingId);
  if (lid) {
    q = q.eq("id", lid);
  }

  const { data: candidates, error: listErr } = await q;

  if (listErr) {
    return {
      processed: 0,
      jobsCreated: 0,
      expiredNoBids: 0,
      endedWithoutJob: 0,
      errors: [listErr.message],
    };
  }

  const rows = (candidates ?? []) as { id: string; lister_id: string; title: string | null }[];
  let processed = 0;
  let jobsCreated = 0;
  let expiredNoBids = 0;
  let endedWithoutJob = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const listingId = row.id;

    const { data: blockingJobs } = await admin
      .from("jobs")
      .select("id")
      .eq("listing_id", listingId)
      .neq("status", "cancelled")
      .limit(1);

    if (blockingJobs && blockingJobs.length > 0) {
      continue;
    }

    const { data: bidRows } = await admin
      .from("bids")
      .select("id, amount_cents, cleaner_id, status, pending_confirmation_expires_at")
      .eq("listing_id", listingId);

    const bids = (bidRows ?? []) as {
      id: string;
      amount_cents: number;
      cleaner_id: string;
      status: string;
      pending_confirmation_expires_at: string | null;
    }[];

    if (bids.length === 0) {
      const { error: upErr } = await admin
        .from("listings")
        .update({ status: "expired" } as never)
        .eq("id", listingId)
        .eq("status", "live");
      if (upErr) {
        errors.push(`${listingId}: ${upErr.message}`);
        continue;
      }
      processed++;
      expiredNoBids++;
      const titleTrim = row.title?.trim() ?? null;
      const noBidMsg = titleTrim
        ? `Your auction "${titleTrim}" ended with no bids. You can relist or post a new listing from My Listings.`
        : "Your auction ended with no bids. You can relist or post a new listing from My Listings.";
      try {
        await createNotification(row.lister_id, "listing_expired_no_bids", null, noBidMsg, {
          listingUuid: listingId,
          listingTitle: titleTrim,
        });
      } catch (e) {
        console.error("[resolveExpiredLiveAuctions] lister no-bids notification failed", e);
      }
      revalidateListingPaths(listingId);
      continue;
    }

    const nowMs = Date.now();
    /** Same pool as buy-now / bid UIs: `active` plus unexpired `pending_confirmation` (email early-accept flow). */
    const eligibleAuctionBids = bids.filter((b) => {
      if (b.status === "active") return true;
      if (b.status !== "pending_confirmation") return false;
      const exp = b.pending_confirmation_expires_at
        ? Date.parse(String(b.pending_confirmation_expires_at))
        : NaN;
      if (!Number.isFinite(exp)) return true;
      return exp >= nowMs;
    });

    const activeBids = eligibleAuctionBids.sort((a, b) => {
      if (a.amount_cents !== b.amount_cents) return a.amount_cents - b.amount_cents;
      return String(a.id).localeCompare(String(b.id));
    });

    if (activeBids.length === 0) {
      const { error: upErr } = await admin
        .from("listings")
        .update({ status: "ended" } as never)
        .eq("id", listingId)
        .eq("status", "live");
      if (upErr) {
        errors.push(`${listingId}: ${upErr.message}`);
        continue;
      }
      processed++;
      endedWithoutJob++;
      revalidateListingPaths(listingId);
      continue;
    }

    const winningBid = activeBids[0]!;
    const result = await finalizeBidAcceptanceCore({
      listingId,
      listerId: row.lister_id,
      cleanerId: winningBid.cleaner_id,
      acceptedAmountCents: winningBid.amount_cents,
      listingTitle: row.title ?? null,
      acceptedBidId: winningBid.id,
    });

    if (!result.ok) {
      const { error: upErr } = await admin
        .from("listings")
        .update({ status: "ended" } as never)
        .eq("id", listingId)
        .eq("status", "live");
      if (upErr) {
        errors.push(`${listingId}: finalize failed (${result.error}); ${upErr.message}`);
      } else {
        endedWithoutJob++;
        await createNotification(
          row.lister_id,
          "job_status_update",
          null,
          `The auction ended, but the winning bid could not be assigned automatically: ${result.error}. Please contact support or assign a cleaner manually if available.`,
          { listingUuid: listingId }
        );
      }
      processed++;
      revalidateListingPaths(listingId);
      continue;
    }

    processed++;
    jobsCreated++;
    revalidateListingPaths(listingId);
  }

  if (processed > 0) {
    revalidateJobsBrowseCaches();
  }

  return {
    processed,
    jobsCreated,
    expiredNoBids,
    endedWithoutJob,
    errors,
  };
}

function revalidateListingPaths(listingId: string) {
  revalidatePath("/jobs");
  revalidatePath("/find-jobs");
  revalidatePath("/my-listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");
}

/** Single listing (e.g. when countdown hits zero on the listing page). */
export async function resolveAuctionEndForListing(
  listingId: string
): Promise<ResolveAuctionsResult> {
  return resolveExpiredLiveAuctions({ listingId: trimStr(listingId) });
}
