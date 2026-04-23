"use server";

import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/actions/notifications";
import { finalizeBidAcceptanceCore } from "@/lib/actions/jobs";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { revalidateJobsBrowseCaches } from "@/lib/cache-revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sameUuid, trimStr } from "@/lib/utils";
import { JOB_STATUS_NOT_IN_LISTING_SLOT } from "@/lib/jobs/job-status-helpers";

function safeEqualToken(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function formatAud(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export type EarlyBidRequestResult =
  | { ok: true; jobId: number | string }
  | { ok: false; error: string };

/**
 * Lister accepts a bid: creates the job immediately (no cleaner email confirmation step).
 * Cleaner is notified via `job_accepted` (in-app + email + SMS/push per preferences) in {@link finalizeBidAcceptanceCore}.
 */
export async function requestEarlyBidAcceptance(
  listingId: string,
  bidId: string
): Promise<EarlyBidRequestResult> {
  const listingUuid = trimStr(listingId).toLowerCase();
  const bidUuid = trimStr(bidId).toLowerCase();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: listing, error: le } = await admin
    .from("listings")
    .select("id, lister_id, status, title")
    .eq("id", listingUuid)
    .maybeSingle();
  if (le || !listing) {
    return { ok: false, error: "Listing not found." };
  }
  const list = listing as {
    lister_id: string;
    status: string;
    title: string | null;
  };
  if (!sameUuid(list.lister_id, user.id)) {
    return { ok: false, error: "Only the lister can accept a bid." };
  }
  if (list.status !== "live") {
    return { ok: false, error: "This listing is no longer accepting bids." };
  }

  /**
   * Block only when a non-cancelled job exists. Cancelled jobs leave the listing live again;
   * the job page also treats cancelled jobs as "no active job" for auction UI.
   */
  const { data: blockingJobs } = await admin
    .from("jobs")
    .select("id")
    .eq("listing_id", listingUuid)
    .not("status", "in", JOB_STATUS_NOT_IN_LISTING_SLOT)
    .limit(1);
  if (blockingJobs && blockingJobs.length > 0) {
    return { ok: false, error: "A job already exists for this listing." };
  }

  const { data: bid, error: be } = await admin
    .from("bids")
    .select("id, listing_id, cleaner_id, amount_cents, status")
    .eq("id", bidUuid)
    .maybeSingle();
  if (be || !bid) {
    return { ok: false, error: "Bid not found." };
  }
  const b = bid as {
    id: string;
    listing_id: string;
    cleaner_id: string;
    amount_cents: number;
    status: string;
  };
  if (!sameUuid(b.listing_id, listingUuid)) {
    return { ok: false, error: "This bid does not belong to this listing." };
  }
  if (b.status !== "active") {
    return { ok: false, error: "This bid can no longer be selected." };
  }

  const settings = await getGlobalSettings();
  if (settings?.require_stripe_connect_before_bidding === true) {
    const { data: cleanerProfile } = await admin
      .from("profiles")
      .select("stripe_connect_id, stripe_onboarding_complete")
      .eq("id", b.cleaner_id)
      .maybeSingle();
    const cp = cleanerProfile as { stripe_connect_id?: string | null; stripe_onboarding_complete?: boolean } | null;
    if (!trimStr(cp?.stripe_connect_id) || cp?.stripe_onboarding_complete !== true) {
      return {
        ok: false,
        error:
          "This cleaner has not connected their bank account yet. They need to connect in Profile before you can accept their bid.",
      };
    }
  }

  const result = await finalizeBidAcceptanceCore({
    listingId: listingUuid,
    listerId: list.lister_id,
    cleanerId: b.cleaner_id,
    acceptedAmountCents: b.amount_cents,
    listingTitle: list.title ?? null,
    acceptedBidId: b.id,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, jobId: result.jobId };
}

export type EarlyBidTokenResult =
  | { ok: true; redirectPath: string }
  | { ok: false; error: string };

export async function confirmEarlyBidByToken(token: string): Promise<EarlyBidTokenResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: bid, error } = await admin
    .from("bids")
    .select("id, listing_id, cleaner_id, amount_cents, status, early_action_token, pending_confirmation_expires_at")
    .eq("early_action_token", token)
    .maybeSingle();

  if (error || !bid) {
    return { ok: false, error: "Invalid or expired link." };
  }
  const b = bid as {
    id: string;
    listing_id: string;
    cleaner_id: string;
    amount_cents: number;
    status: string;
    early_action_token: string | null;
    pending_confirmation_expires_at: string | null;
  };

  if (!safeEqualToken(b.early_action_token ?? "", token)) {
    return { ok: false, error: "Invalid or expired link." };
  }
  if (b.status !== "pending_confirmation") {
    return { ok: false, error: "This offer is no longer pending." };
  }
  if (b.pending_confirmation_expires_at && new Date(b.pending_confirmation_expires_at) < new Date()) {
    return { ok: false, error: "This offer has expired." };
  }

  const { data: listing } = await admin
    .from("listings")
    .select("lister_id, title, status")
    .eq("id", b.listing_id)
    .maybeSingle();
  const list = listing as { lister_id: string; title: string | null; status: string } | null;
  if (!list || list.status !== "live") {
    return { ok: false, error: "This listing is no longer available." };
  }

  const result = await finalizeBidAcceptanceCore({
    listingId: b.listing_id,
    listerId: list.lister_id,
    cleanerId: b.cleaner_id,
    acceptedAmountCents: b.amount_cents,
    listingTitle: list.title ?? null,
    acceptedBidId: b.id,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    redirectPath: `/jobs/${encodeURIComponent(String(result.jobId))}?early_confirm=success`,
  };
}

export async function declineEarlyBidByToken(token: string): Promise<EarlyBidTokenResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: bid, error } = await admin
    .from("bids")
    .select("id, listing_id, cleaner_id, status, early_action_token, pending_confirmation_expires_at")
    .eq("early_action_token", token)
    .maybeSingle();

  if (error || !bid) {
    return { ok: false, error: "Invalid or expired link." };
  }
  const b = bid as {
    id: string;
    listing_id: string;
    cleaner_id: string;
    status: string;
    early_action_token: string | null;
    pending_confirmation_expires_at: string | null;
  };

  if (!safeEqualToken(b.early_action_token ?? "", token)) {
    return { ok: false, error: "Invalid or expired link." };
  }
  if (b.status !== "pending_confirmation") {
    return { ok: false, error: "This offer is no longer pending." };
  }
  if (b.pending_confirmation_expires_at && new Date(b.pending_confirmation_expires_at) < new Date()) {
    return { ok: false, error: "This offer has expired." };
  }

  const { data: listing } = await admin
    .from("listings")
    .select("lister_id, title")
    .eq("id", b.listing_id)
    .maybeSingle();
  const list = listing as { lister_id: string; title: string | null } | null;
  if (!list) {
    return { ok: false, error: "Listing not found." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, full_name")
    .eq("id", b.cleaner_id)
    .maybeSingle();
  const pr = profile as { display_name?: string | null; full_name?: string | null } | null;
  const cleanerName =
    trimStr(pr?.display_name) ||
    trimStr(pr?.full_name) ||
    "The cleaner";

  await admin
    .from("bids")
    .update({
      status: "declined_early",
      early_action_token: null,
      pending_confirmation_expires_at: null,
    } as never)
    .eq("id", b.id);

  await createNotification(
    list.lister_id,
    "early_accept_declined",
    null,
    `${cleanerName} declined your early acceptance.`,
    { listingUuid: b.listing_id, listingTitle: list.title ?? null, senderName: cleanerName }
  );

  revalidateJobsBrowseCaches();
  revalidatePath("/jobs");
  revalidatePath(`/listings/${b.listing_id}`);
  revalidatePath(`/jobs/${b.listing_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");

  return {
    ok: true,
    redirectPath: `/listings/${encodeURIComponent(b.listing_id)}?early_decline=1`,
  };
}

export async function expireStaleEarlyBidAcceptances(): Promise<{
  expired: number;
  errors: string[];
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { expired: 0, errors: ["SUPABASE_SERVICE_ROLE_KEY not configured"] };
  }
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("bids")
    .select("id, listing_id, cleaner_id")
    .eq("status", "pending_confirmation")
    .lt("pending_confirmation_expires_at", nowIso);

  if (error) {
    return { expired: 0, errors: [error.message] };
  }

  const errors: string[] = [];
  let expired = 0;

  for (const raw of rows ?? []) {
    const row = raw as {
      id: string;
      listing_id: string;
      cleaner_id: string;
    };
    const { data: list } = await admin
      .from("listings")
      .select("lister_id")
      .eq("id", row.listing_id)
      .maybeSingle();
    const listerId = (list as { lister_id: string } | null)?.lister_id;
    if (!listerId) continue;

    const { error: uErr } = await admin
      .from("bids")
      .update({
        status: "active",
        early_action_token: null,
        pending_confirmation_expires_at: null,
      } as never)
      .eq("id", row.id)
      .eq("status", "pending_confirmation");

    if (uErr) {
      errors.push(`${row.id}: ${uErr.message}`);
      continue;
    }
    expired++;

    await createNotification(
      listerId,
      "job_status_update",
      null,
      "Your early acceptance offer expired without a response from the cleaner. The auction continues.",
      { listingUuid: row.listing_id }
    );
    await createNotification(
      row.cleaner_id,
      "job_status_update",
      null,
      "An early acceptance offer on a job you bid on has expired. You can continue bidding if the listing is still open.",
      { listingUuid: row.listing_id }
    );
  }

  if (expired > 0) {
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
  }

  return { expired, errors };
}

/**
 * After a new active bid is placed: if another bid was pending early acceptance and is no longer
 * the best (lowest) active bid, revert it to active and notify parties.
 */
export async function invalidatePendingEarlyAcceptIfSuperseded(listingId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: pending } = await admin
    .from("bids")
    .select("id, amount_cents, cleaner_id")
    .eq("listing_id", listingId)
    .eq("status", "pending_confirmation")
    .maybeSingle();

  if (!pending) return;

  const p = pending as { id: string; amount_cents: number; cleaner_id: string };

  const { data: bestActive } = await admin
    .from("bids")
    .select("amount_cents")
    .eq("listing_id", listingId)
    .eq("status", "active")
    .order("amount_cents", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!bestActive) return;

  const best = bestActive as { amount_cents: number };

  if (best.amount_cents < p.amount_cents) {
    const { data: list } = await admin
      .from("listings")
      .select("lister_id")
      .eq("id", listingId)
      .maybeSingle();
    const listerId = (list as { lister_id: string } | null)?.lister_id;
    if (!listerId) return;

    await admin
      .from("bids")
      .update({
        status: "active",
        early_action_token: null,
        pending_confirmation_expires_at: null,
      } as never)
      .eq("id", p.id);

    await createNotification(
      listerId,
      "job_status_update",
      null,
      "Your early acceptance was cancelled because a lower bid was placed. The auction continues.",
      { listingUuid: listingId }
    );
    await createNotification(
      p.cleaner_id,
      "job_status_update",
      null,
      "An early acceptance offer is no longer valid because another cleaner placed a lower bid.",
      { listingUuid: listingId }
    );

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${listingId}`);
  }
}
