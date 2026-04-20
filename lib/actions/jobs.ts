"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { revalidateJobsBrowseCaches } from "@/lib/cache-revalidate";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { createNotification, sendPaymentReceiptEmails, sendRefundReceiptEmail } from "@/lib/actions/notifications";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import {
  fetchPlatformFeePercentForListing,
  resolvePlatformFeePercent,
} from "@/lib/platform-fee";
import {
  getStripeServer,
  createJobCheckoutSessionUrl,
  createJobPaymentIntentWithSavedMethod,
  createJobTopUpCheckoutSessionUrl,
} from "@/lib/stripe";
import {
  buildEscrowReleaseLegs,
  isValidJobTopUpAgreedCents,
  isValidCleanerRequestTopUpCents,
  isValidStoredTopUpAgreedCents,
  parseJobTopUpPayments,
  type JobTopUpPaymentRecord,
} from "@/lib/job-top-up";
import { isStripeTestMode } from "@/lib/stripe/config";
import { ensureConnectAccountCanReceiveTransfers } from "@/lib/actions/stripe-connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";
import { applyReferralRewardsForCompletedJob } from "@/lib/actions/referral-rewards";
import { logTimerActivity } from "@/lib/admin-activity-log";
import { getCleanerReadyToRequestPaymentByJobId } from "@/lib/jobs/cleaner-complete-readiness";
import { formatListingAddonDisplayName } from "@/lib/listing-addon-prices";
import { isSpecialAreaForJobChecklist } from "@/lib/listing-special-areas";
import { sameUuid, trimStr } from "@/lib/utils";
import { listerPaymentDueAtFromNowIso } from "@/lib/jobs/lister-payment-deadline";
import { isProfileStripePayoutReady } from "@/lib/stripe-payout-ready";
import { hasRecentJobNotification } from "@/lib/notifications/notification-dedupe";
import { disputeOpenedByLister } from "@/lib/jobs/dispute-opened-by";
import {
  disputeHubLinksHtml,
  escapeHtmlForEmail,
  insertDisputeThreadEntry,
  notifyAdminUsersAboutJob,
  sendDisputeActivityEmail,
} from "@/lib/disputes/dispute-thread-and-notify";

async function maybeNotifyCleanerJobWonStripePayoutSetup(params: {
  cleanerId: string;
  jobId: number;
  listingId: string;
  listingTitle: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: prof } = await admin
    .from("profiles")
    .select("stripe_connect_id, stripe_onboarding_complete")
    .eq("id", params.cleanerId)
    .maybeSingle();
  if (isProfileStripePayoutReady(prof)) return;
  try {
    await createNotification(
      params.cleanerId,
      "job_won_complete_payout",
      params.jobId,
      "You've won this job! Complete your Stripe payout setup under Profile → Payments so you can receive funds when the lister releases payment.",
      { listingTitle: params.listingTitle, listingUuid: params.listingId }
    );
  } catch (e) {
    console.error("[maybeNotifyCleanerJobWonStripePayoutSetup]", e);
  }
}

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
const DEFAULT_CLEANER_CHECKLIST_LABELS = [
  "Vacuum Apartment/House",
  "Clean all Bedrooms",
  "Clean all Bathrooms",
  "Clean Toilet",
  "Clean Kitchen",
  "Clean Laundry",
  "Mop Floors (if needed)",
];

async function loadDefaultCleanerChecklistLabels(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string[]> {
  const fallback = [...DEFAULT_CLEANER_CHECKLIST_LABELS];
  const { data, error } = await supabase
    .from("global_settings")
    .select("default_cleaner_checklist_items")
    .eq("id", 1)
    .maybeSingle();

  const maybeMissingColumn =
    (error as { code?: string; message?: string } | null)?.code === "42703" ||
    ((error as { message?: string } | null)?.message ?? "")
      .toLowerCase()
      .includes("default_cleaner_checklist_items");
  if (error && !maybeMissingColumn) return fallback;

  const labels = (data as { default_cleaner_checklist_items?: unknown } | null)
    ?.default_cleaner_checklist_items;
  if (!Array.isArray(labels)) return fallback;
  const cleaned = labels
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0);
  return cleaned.length > 0 ? cleaned : fallback;
}

export type CreateJobPaymentResult =
  | { ok: true; paymentIntentId: string }
  | { ok: false; error: string };

/**
 * Create a Stripe PaymentIntent to hold payment for a job (manual capture).
 * Amount = job price (agreed_amount_cents) + platform fee.
 * Stores payment_intent_id on the job. Idempotent if job already has payment_intent_id.
 */
export async function createJobPayment(
  jobId: number | string
): Promise<CreateJobPaymentResult> {
  const supabase = await createServerSupabaseClient();
  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, listing_id, lister_id, winner_id, agreed_amount_cents, payment_intent_id")
    .eq("id", numericJobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const j = job as {
    listing_id: string | number;
    lister_id: string;
    winner_id: string | null;
    agreed_amount_cents: number | null;
    payment_intent_id: string | null;
  };

  if (trimStr(j.payment_intent_id)) {
    return { ok: true, paymentIntentId: String(j.payment_intent_id) };
  }

  let agreedCents = j.agreed_amount_cents ?? null;
  if (agreedCents == null && j.listing_id) {
    const { data: listing } = await supabase
      .from("listings")
      .select("buy_now_cents, current_lowest_bid_cents")
      .eq("id", j.listing_id)
      .maybeSingle();
    const row = listing as { buy_now_cents?: number | null; current_lowest_bid_cents?: number } | null;
    agreedCents = row?.buy_now_cents ?? row?.current_lowest_bid_cents ?? null;
  }

  if (agreedCents == null || agreedCents < 1) {
    return { ok: false, error: "Job has no agreed amount. Set agreed_amount_cents or listing price." };
  }

  const settings = await getGlobalSettings();
  const feePercent = await fetchPlatformFeePercentForListing(
    supabase,
    j.listing_id,
    settings
  );
  const feeCents = Math.round((agreedCents * feePercent) / 100);
  const totalCents = agreedCents + feeCents;

  let stripe;
  try {
    stripe = await getStripeServer();
  } catch (e) {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "aud",
      capture_method: "manual",
      metadata: {
        job_id: String(numericJobId),
        lister_id: j.lister_id,
        cleaner_id: j.winner_id ?? "",
      },
    });

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        payment_intent_id: pi.id,
        lister_payment_due_at: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", numericJobId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    return { ok: true, paymentIntentId: pi.id };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message ?? "Failed to create payment hold." };
  }
}

export type AcceptBidResult =
  | { ok: true; jobId: number | string }
  | { ok: false; error: string };

/**
 * Lister accepts a bid: create job with winner_id = cleanerId and agreed_amount_cents.
 * Called from `requestEarlyBidAcceptance` (immediate accept) and legacy email token `confirmEarlyBidByToken`.
 * Listing is closed, other bids cancelled.
 */
export async function finalizeBidAcceptanceCore(params: {
  listingId: string;
  listerId: string;
  cleanerId: string;
  acceptedAmountCents: number;
  listingTitle: string | null;
  /** Winning bid row — marked `accepted`; all other bids for the listing become `cancelled`. */
  acceptedBidId: string;
}): Promise<AcceptBidResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: listing, error: fetchError } = await admin
    .from("listings")
    .select("id, lister_id, status, title")
    .eq("id", params.listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const listRow = listing as {
    id: string;
    lister_id: string;
    status: string;
    title?: string | null;
  };

  if (!sameUuid(listRow.lister_id, params.listerId)) {
    return { ok: false, error: "Listing mismatch." };
  }

  if (listRow.status !== "live") {
    return { ok: false, error: "This listing is no longer accepting bids." };
  }

  const cleanerId = trimStr(params.cleanerId);
  if (!cleanerId) {
    return { ok: false, error: "Invalid winning bidder." };
  }

  const settings = await getGlobalSettings();
  if (settings?.require_stripe_connect_before_bidding === true) {
    const { data: cleanerProfile } = await admin
      .from("profiles")
      .select("stripe_connect_id, stripe_onboarding_complete")
      .eq("id", cleanerId)
      .maybeSingle();
    const cp = cleanerProfile as { stripe_connect_id?: string | null; stripe_onboarding_complete?: boolean } | null;
    const stripeConnectId = cp?.stripe_connect_id;
    const onboardingComplete = cp?.stripe_onboarding_complete === true;
    if (!trimStr(stripeConnectId) || !onboardingComplete) {
      return {
        ok: false,
        error:
          "This cleaner has not finished Stripe Connect in Profile. They must connect their bank account before you can accept their bid.",
      };
    }
  }

  const { data: existingJob } = await admin
    .from("jobs")
    .select("id")
    .eq("listing_id", listRow.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existingJob) {
    return { ok: false, error: "A job already exists for this listing." };
  }

  const amountCents = Math.max(0, Math.round(Number(params.acceptedAmountCents)));
  if (amountCents < 1) {
    return { ok: false, error: "Invalid bid amount." };
  }

  const { data: inserted, error: insertError } = await admin
    .from("jobs")
    .insert({
      listing_id: listRow.id,
      lister_id: listRow.lister_id,
      winner_id: cleanerId,
      status: "accepted",
      agreed_amount_cents: amountCents,
      secured_via_buy_now: false,
      lister_payment_due_at: listerPaymentDueAtFromNowIso(),
    } as never)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Failed to create job.",
    };
  }

  const jobId = (inserted as { id: number | string }).id;
  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const acceptedId = trimStr(params.acceptedBidId);
  if (!acceptedId) {
    return { ok: false, error: "Missing accepted bid." };
  }
  await admin
    .from("bids")
    .update({ status: "cancelled" } as never)
    .eq("listing_id", params.listingId)
    .neq("id", acceptedId);
  await admin.from("bids").update({ status: "accepted" } as never).eq("id", acceptedId);

  await admin.from("listings").update({ status: "ended" } as never).eq("id", params.listingId);

  const listingTitle = params.listingTitle ?? listRow.title ?? null;
  try {
    await createNotification(
      params.listerId,
      "job_created",
      numericJobId,
      "You accepted a bid. Pay & Start Job to hold funds in escrow and start the job."
    );
  } catch (e) {
    console.error("[finalizeBidAcceptanceCore] lister notification failed", e);
  }
  try {
    await createNotification(
      cleanerId,
      "job_accepted",
      numericJobId,
      "You won this job — the lister accepted your bid. They'll pay and start the job to hold funds in escrow; then you can begin.",
      { listingTitle }
    );
  } catch (e) {
    console.error("[finalizeBidAcceptanceCore] cleaner notification failed", e);
  }
  await maybeNotifyCleanerJobWonStripePayoutSetup({
    cleanerId,
    jobId: numericJobId,
    listingId: params.listingId,
    listingTitle,
  });

  revalidateJobsBrowseCaches();
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${numericJobId}`);
  revalidatePath(`/jobs/${params.listingId}`);
  revalidatePath(`/listings/${params.listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");

  return { ok: true, jobId };
}

export type SecureJobAtPriceResult =
  | { ok: true; jobId: number | string }
  | { ok: false; error: string };

/**
 * Cleaner secures the job at the listing's fixed (buy-now) price.
 * Creates a job with winner_id = current user; lister then pays via Pay & Start Job (Stripe) to hold funds in escrow.
 */
export async function secureJobAtPrice(
  listingId: string
): Promise<SecureJobAtPriceResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, lister_id, status, buy_now_cents, title")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const listRow = listing as {
    id: string;
    lister_id: string;
    status: string;
    buy_now_cents?: number | null;
    title?: string | null;
  };

  if (listRow.status !== "live") {
    return { ok: false, error: "This listing is no longer available at this price." };
  }

  if (!listRow.buy_now_cents || listRow.buy_now_cents < 1) {
    return { ok: false, error: "This listing has no fixed price set." };
  }

  const settings = await getGlobalSettings();
  if (settings?.require_stripe_connect_before_bidding === true) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("stripe_connect_id, stripe_onboarding_complete")
      .eq("id", session.user.id)
      .maybeSingle();
    const pr = profileRow as { stripe_connect_id?: string | null; stripe_onboarding_complete?: boolean } | null;
    if (!trimStr(pr?.stripe_connect_id) || pr?.stripe_onboarding_complete !== true) {
      return {
        ok: false,
        error: "Please connect your bank account to receive payment. Go to Profile or Settings to connect.",
      };
    }
  }

  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id")
    .eq("listing_id", listRow.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existingJob) {
    return { ok: false, error: "This job is already taken." };
  }

  const dueAt = listerPaymentDueAtFromNowIso();
  const { data: inserted, error: insertError } = await supabase
    .from("jobs")
    .insert({
      listing_id: listRow.id,
      lister_id: listRow.lister_id,
      winner_id: session.user.id,
      status: "accepted",
      agreed_amount_cents: listRow.buy_now_cents,
      secured_via_buy_now: true,
      lister_payment_due_at: dueAt,
    } as never)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Failed to secure job.",
    };
  }

  const jobId = (inserted as { id: number | string }).id;
  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const admin = createSupabaseAdminClient();
  const listingTitle = listRow.title ?? null;
  const buyNowCents = listRow.buy_now_cents!;
  const buyNowDisplay = `$${(buyNowCents / 100).toFixed(2)}`;

  if (admin) {
    const { data: loserBidRows } = await admin
      .from("bids")
      .select("cleaner_id")
      .eq("listing_id", listRow.id)
      .in("status", ["active", "pending_confirmation"])
      .neq("cleaner_id", session.user.id);
    const loserIds = new Set<string>();
    for (const lr of loserBidRows ?? []) {
      const cid = (lr as { cleaner_id: string }).cleaner_id;
      if (cid) loserIds.add(cid);
    }
    await admin
      .from("bids")
      .update({ status: "cancelled" } as never)
      .eq("listing_id", listRow.id)
      .in("status", ["active", "pending_confirmation"]);

    const tShort = (listingTitle ?? "this listing").trim();
    const loserMsg = `Another cleaner secured "${tShort}" at the fixed price of ${buyNowDisplay}. Your bid is no longer active.`;
    for (const loserId of loserIds) {
      try {
        await createNotification(loserId, "listing_assigned_buy_now", null, loserMsg, {
          listingUuid: listingId,
          listingTitle,
          amountCents: buyNowCents,
        });
      } catch (e) {
        console.error("[secureJobAtPrice] loser notification failed", e);
      }
    }

    await admin
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", listRow.id)
      .eq("status", "live");
  }

  await createNotification(
    listRow.lister_id,
    "job_created",
    numericJobId,
    "A cleaner secured this job at your fixed price. Pay & Start Job to hold funds in escrow and start the job."
  );
  await createNotification(
    session.user.id,
    "job_accepted",
    numericJobId,
    "You secured this job. The lister will pay and start the job to hold funds in escrow; then you can begin.",
    { listingTitle }
  );
  await maybeNotifyCleanerJobWonStripePayoutSetup({
    cleanerId: session.user.id,
    jobId: numericJobId,
    listingId: listRow.id,
    listingTitle,
  });

  revalidateJobsBrowseCaches();
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${numericJobId}`);
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");
  revalidatePath("/find-jobs");

  return { ok: true, jobId };
}

export type CreateJobCheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: true; alreadyPaid: true }
  | { ok: false; error: string };

/**
 * Create a Stripe Checkout URL for the lister to pay and start the job (funds go into escrow).
 * Call when job has no payment_intent_id yet; lister is redirected to Stripe Checkout (Pay & Start Job).
 */
export async function createJobCheckoutSession(
  jobId: string | number
): Promise<CreateJobCheckoutSessionResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, listing_id, agreed_amount_cents, payment_intent_id")
    .eq("id", numericJobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const row = job as {
    id: number | string;
    lister_id: string;
    winner_id: string | null;
    status: string;
    listing_id: string;
    agreed_amount_cents?: number | null;
    payment_intent_id?: string | null;
  };

  if (row.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can pay and start this job." };
  }

  if (row.status !== "accepted") {
    return { ok: false, error: "Job must be in 'accepted' status to pay and start." };
  }

  if (trimStr(row.payment_intent_id)) {
    return { ok: false, error: "Payment is already held in escrow for this job." };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, suburb, postcode, buy_now_cents, reserve_cents, platform_fee_percentage")
    .eq("id", row.listing_id)
    .maybeSingle();

  if (!listing) {
    return { ok: false, error: "Listing not found." };
  }

  // Use job's agreed amount, or fall back to listing price so Pay & Start Job still works
  let agreedCents = row.agreed_amount_cents ?? 0;
  if (agreedCents < 1) {
    const listingRow = listing as { buy_now_cents?: number | null; reserve_cents?: number | null };
    agreedCents = listingRow.buy_now_cents ?? listingRow.reserve_cents ?? 0;
    if (agreedCents > 0) {
      await supabase
        .from("jobs")
        .update({ agreed_amount_cents: agreedCents, updated_at: new Date().toISOString() } as never)
        .eq("id", numericJobId);
    }
  }
  if (agreedCents < 1) {
    return { ok: false, error: "Job has no agreed amount. The listing needs a buy-now or reserve price." };
  }

  const settings = await getGlobalSettings();
  const feePercent = resolvePlatformFeePercent(
    (listing as { platform_fee_percentage?: number | null }).platform_fee_percentage,
    settings
  );

  const { data: listerProfile } = await supabase
    .from("profiles")
    .select("stripe_payment_method_id, stripe_customer_id")
    .eq("id", row.lister_id)
    .maybeSingle();

  const pmId = trimStr(
    (listerProfile as { stripe_payment_method_id?: string | null } | null)?.stripe_payment_method_id
  );
  let customerId =
    trimStr(
      (listerProfile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
    ) || null;

  const ensureStripeCustomerId = async (): Promise<string | null> => {
    if (customerId) return customerId;
    let stripe;
    try {
      stripe = await getStripeServer();
    } catch {
      return null;
    }
    try {
      const customer = await stripe.customers.create({
        metadata: { user_id: row.lister_id, type: "lister_job_checkout" },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", row.lister_id);
      return customer.id;
    } catch (err) {
      console.error("[createJobCheckoutSession] could not create Stripe customer", err);
      return null;
    }
  };

  if (pmId) {
    try {
      const resolved = await createJobPaymentIntentWithSavedMethod(
        numericJobId,
        agreedCents,
        feePercent,
        pmId,
        customerId || null,
        {
          title: (listing as { title?: string }).title ?? "Bond clean",
          suburb: (listing as { suburb?: string }).suburb ?? "",
          postcode: (listing as { postcode?: string }).postcode ?? "",
        }
      );
      if ("error" in resolved) {
        return { ok: false, error: resolved.error };
      }
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("jobs")
        .update({
          payment_intent_id: resolved.paymentIntentId,
          status: "in_progress",
          lister_payment_due_at: null,
          updated_at: nowIso,
        } as never)
        .eq("id", numericJobId);
      if (updateErr) {
        return { ok: false, error: updateErr.message };
      }
      if (await isStripeTestMode()) {
        console.log("[Stripe Test] PaymentIntent created (saved method):", resolved.paymentIntentId);
      }
      revalidatePath(`/jobs/${numericJobId}`);
      return { ok: true, alreadyPaid: true };
    } catch (e) {
      const err = e as Error;
      return { ok: false, error: err.message ?? "Failed to charge saved payment method." };
    }
  }

  try {
    const checkoutCustomerId = await ensureStripeCustomerId();
    const url = await createJobCheckoutSessionUrl(
      { id: numericJobId, agreed_amount_cents: agreedCents },
      { title: (listing as { title?: string }).title ?? "Bond clean", suburb: (listing as { suburb?: string }).suburb ?? "", postcode: (listing as { postcode?: string }).postcode ?? "" },
      feePercent,
      checkoutCustomerId
    );
    if (!url) {
      console.error("[createJobCheckoutSession] Stripe returned no checkout URL");
      return { ok: false, error: "Stripe did not return a payment link. Please try again." };
    }
    return { ok: true, url };
  } catch (e) {
    const err = e as Error;
    const msg = err?.message ?? "";
    console.error("[createJobCheckoutSession] Checkout error:", msg, e);
    // User-friendly messages for known failures
    if (!msg || /missing|not configured|STRIPE|secret_key|publishable/i.test(msg)) {
      return {
        ok: false,
        error:
          "Payment is not configured. Add Stripe keys to .env (STRIPE_SECRET_KEY_TEST, etc.) and ensure Admin > Global Settings has the correct mode.",
      };
    }
    if (/invalid|api_key|authentication/i.test(msg)) {
      return { ok: false, error: "Invalid Stripe keys. Check .env and Admin Global Settings." };
    }
    return { ok: false, error: msg || "Could not start payment. Please try again." };
  }
}

export type FulfillJobPaymentFromSessionResult =
  | { ok: true; notice?: "success" | "top_up_success" }
  | { ok: false; error: string };

export type CreateJobTopUpCheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Lister-only: extra escrow hold via a new Stripe Checkout session (separate PaymentIntent from initial pay).
 */
export async function createJobTopUpCheckoutSession(
  jobId: string | number,
  topUpAgreedCents: number,
  note: string | null,
  options?: { flexibleCleanerRequest?: boolean }
): Promise<CreateJobTopUpCheckoutSessionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }
  const flexible = options?.flexibleCleanerRequest === true;
  if (flexible) {
    if (!isValidCleanerRequestTopUpCents(topUpAgreedCents)) {
      return { ok: false, error: "Invalid top-up amount for this request." };
    }
  } else if (!isValidJobTopUpAgreedCents(topUpAgreedCents)) {
    return {
      ok: false,
      error: "Top-up must be at least $20 and in $10 increments.",
    };
  }

  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, listing_id, agreed_amount_cents, payment_intent_id, payment_released_at"
    )
    .eq("id", numericJobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const row = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    listing_id: string;
    payment_intent_id: string | null;
    payment_released_at: string | null;
    top_up_payments?: unknown;
  };

  const { data: listerProfile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", row.lister_id)
    .maybeSingle();
  let customerId =
    trimStr(
      (listerProfile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
    ) || null;

  const ensureStripeCustomerId = async (): Promise<string | null> => {
    if (customerId) return customerId;
    let stripe;
    try {
      stripe = await getStripeServer();
    } catch {
      return null;
    }
    try {
      const customer = await stripe.customers.create({
        metadata: { user_id: row.lister_id, type: "lister_job_top_up" },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", row.lister_id);
      return customer.id;
    } catch (err) {
      console.error("[createJobTopUpCheckoutSession] could not create Stripe customer", err);
      return null;
    }
  };

  if (row.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can add a top-up for this job." };
  }
  if (trimStr(row.payment_released_at)) {
    return { ok: false, error: "Funds have already been released; top-up is not available." };
  }
  if (!trimStr(row.payment_intent_id)) {
    return { ok: false, error: "Pay & Start Job first before adding a top-up." };
  }
  const st = String(row.status ?? "");
  const topUpOkStatuses = flexible
    ? ["in_progress", "completed_pending_approval", "disputed", "dispute_negotiating"]
    : ["in_progress", "completed_pending_approval"];
  if (!topUpOkStatuses.includes(st)) {
    return {
      ok: false,
      error: flexible
        ? "Top-up is not available for this job in its current state."
        : "Top-up is only available while the job is in progress or awaiting your release.",
    };
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("title, suburb, postcode, platform_fee_percentage")
    .eq("id", row.listing_id)
    .maybeSingle();
  if (listingError || !listing) {
    return { ok: false, error: "Listing not found for this job." };
  }

  const settings = await getGlobalSettings();
  const feePercent = await fetchPlatformFeePercentForListing(
    supabase,
    row.listing_id,
    settings
  );

  let url: string | null;
  try {
    const checkoutCustomerId = await ensureStripeCustomerId();
    url = await createJobTopUpCheckoutSessionUrl(
      { id: numericJobId, listingId: row.listing_id },
      {
        title: (listing as { title?: string }).title ?? "Bond clean job",
        suburb: (listing as { suburb?: string }).suburb ?? "",
        postcode: (listing as { postcode?: string }).postcode ?? "",
      },
      topUpAgreedCents,
      feePercent,
      note?.trim() ? note.trim().slice(0, 450) : null,
      { listingTitleSuffix: "Top-up", customerId: checkoutCustomerId }
    );
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message ?? "Could not start Stripe checkout." };
  }
  if (!url) {
    return { ok: false, error: "Stripe did not return a payment link." };
  }
  return { ok: true, url };
}

/**
 * After lister returns from Stripe Checkout for a job top-up: record PI, bump agreed_amount_cents, notify cleaner.
 */
export async function fulfillJobTopUpFromSession(
  checkoutSessionId: string
): Promise<FulfillJobPaymentFromSessionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  let stripe: import("stripe").default;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const cs = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["payment_intent"],
    });
    if (cs.mode !== "payment" || cs.metadata?.type !== "job_top_up") {
      return { ok: false, error: "Invalid top-up session." };
    }
    const jobIdMeta = cs.metadata?.job_id ?? cs.client_reference_id;
    if (!jobIdMeta) {
      return { ok: false, error: "No job id on session." };
    }
    const numericJobId = Number(jobIdMeta);
    const agreedFromMeta = Math.floor(Number(cs.metadata?.top_up_agreed_cents ?? 0));
    if (!isValidStoredTopUpAgreedCents(agreedFromMeta)) {
      return { ok: false, error: "Invalid top-up amount on session." };
    }

    const pi =
      typeof cs.payment_intent === "string"
        ? await stripe.paymentIntents.retrieve(cs.payment_intent)
        : (cs.payment_intent as Stripe.PaymentIntent | null);
    if (!pi?.id) {
      return { ok: false, error: "No PaymentIntent on session." };
    }
    if (pi.status !== "requires_capture" && pi.status !== "succeeded") {
      return {
        ok: false,
        error: `Top-up payment is not complete (status: ${pi.status}).`,
      };
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error (admin client)." };
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select(
        "id, lister_id, winner_id, status, agreed_amount_cents, payment_intent_id, payment_released_at, listing_id, top_up_payments"
      )
      .eq("id", numericJobId)
      .maybeSingle();

    if (jobError || !job) {
      return { ok: false, error: "Job not found." };
    }

    const j = job as {
      lister_id: string;
      winner_id: string | null;
      status: string;
      agreed_amount_cents: number | null;
      payment_intent_id: string | null;
      payment_released_at: string | null;
      listing_id: string;
      top_up_payments?: unknown;
    };

    if (j.lister_id !== session.user.id) {
      return { ok: false, error: "Not authorized for this top-up." };
    }
    if (trimStr(j.payment_released_at)) {
      return { ok: false, error: "Funds were already released." };
    }
    const st = String(j.status ?? "");
    if (
      !["in_progress", "completed_pending_approval", "disputed", "dispute_negotiating"].includes(st)
    ) {
      return { ok: false, error: "Job is not in a state that accepts top-ups." };
    }

    const existing = parseJobTopUpPayments(j.top_up_payments as never);
    if (existing.some((e) => e.payment_intent_id === pi.id)) {
      revalidatePath(`/jobs/${numericJobId}`);
      revalidatePath(`/listings/${j.listing_id}`);
      return { ok: true, notice: "top_up_success" };
    }

    const feePercent = await fetchPlatformFeePercentForListing(
      supabase,
      j.listing_id,
      await getGlobalSettings()
    );
    const feeCents = Math.round((agreedFromMeta * feePercent) / 100);
    const noteRaw = String(cs.metadata?.top_up_note ?? "").trim().slice(0, 2000);

    const entry: JobTopUpPaymentRecord = {
      payment_intent_id: pi.id,
      agreed_cents: agreedFromMeta,
      fee_cents: feeCents,
      note: noteRaw || null,
      created_at: new Date().toISOString(),
    };
    const nextList = [...existing, entry];
    const nextAgreed = (j.agreed_amount_cents ?? 0) + agreedFromMeta;

    const { error: updateError } = await admin
      .from("jobs")
      .update({
        agreed_amount_cents: nextAgreed,
        top_up_payments: nextList as unknown as never,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", numericJobId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    if (j.winner_id) {
      const extra = `$${(agreedFromMeta / 100).toFixed(2)}`;
      const msg = `The lister added ${extra} for additional work. Funds are held in escrow until final release.`;
      try {
        await createNotification(j.winner_id, "job_status_update", numericJobId, msg, {
          listingUuid: j.listing_id,
          amountCents: agreedFromMeta,
        });
      } catch (e) {
        console.error("[fulfillJobTopUpFromSession] cleaner notify failed", e);
      }
    }

    revalidatePath(`/jobs/${numericJobId}`);
    revalidatePath(`/listings/${j.listing_id}`);
    revalidatePath("/jobs");
    revalidatePath("/lister/dashboard");
    revalidatePath("/cleaner/dashboard");
    revalidatePath("/messages");
    revalidatePath("/my-listings");
    return { ok: true, notice: "top_up_success" };
  } catch (e) {
    const err = e as Error;
    return {
      ok: false,
      error:
        err.message && err.message.length < 200
          ? err.message
          : "Could not confirm top-up payment.",
    };
  }
}

/**
 * After lister returns from Stripe Checkout (Pay & Start Job), confirm the session and set job to in_progress.
 * Call with session_id from URL so job status updates even when webhooks are not received (e.g. local dev).
 */
export async function fulfillJobPaymentFromSession(
  checkoutSessionId: string
): Promise<FulfillJobPaymentFromSessionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  let stripe: import("stripe").default;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const cs = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["payment_intent"],
    });

    if (cs.mode !== "payment") {
      return { ok: false, error: "Invalid session type." };
    }

    if (cs.metadata?.type === "job_top_up") {
      return fulfillJobTopUpFromSession(checkoutSessionId);
    }

    const jobIdMeta = cs.metadata?.job_id ?? cs.client_reference_id;
    if (!jobIdMeta) {
      return { ok: false, error: "No job id on session." };
    }

    const numericJobId = Number(jobIdMeta);
    const pi =
      typeof cs.payment_intent === "string"
        ? await stripe.paymentIntents.retrieve(cs.payment_intent)
        : (cs.payment_intent as Stripe.PaymentIntent | null);

    if (!pi?.id) {
      return { ok: false, error: "No PaymentIntent on session." };
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("id, lister_id, winner_id, status, listing_id")
      .eq("id", numericJobId)
      .maybeSingle();

    if (!job) {
      return { ok: false, error: "Job not found or you are not the lister." };
    }

    const checkoutJob = job as {
      id: number | string;
      lister_id: string;
      winner_id: string | null;
      status: string;
      listing_id: string;
    };

    if (checkoutJob.lister_id !== session.user.id) {
      return { ok: false, error: "Job not found or you are not the lister." };
    }
    if (checkoutJob.status !== "accepted") {
      return { ok: true };
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        payment_intent_id: pi.id,
        status: "in_progress",
        lister_payment_due_at: null,
        updated_at: nowIso,
      } as never)
      .eq("id", numericJobId)
      .eq("status", "accepted");

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    if (checkoutJob.winner_id) {
      try {
        await createNotification(
          checkoutJob.winner_id,
          "job_approved_to_start",
          numericJobId,
          "Lister approved – you can start the job."
        );
      } catch (notifyErr) {
        console.error("[fulfillJobPaymentFromSession] notification failed", notifyErr);
      }
    }

    try {
      await createNotification(
        checkoutJob.lister_id,
        "job_status_update",
        numericJobId,
        "Payment received — escrow is active. The cleaner has been notified to start the job."
      );
    } catch (notifyErr) {
      console.error("[fulfillJobPaymentFromSession] lister notification failed", notifyErr);
    }

    // Create default cleaning checklist items (same as approveJobStart) so checklist appears
    const { data: existingItems } = await supabase
      .from("job_checklist_items")
      .select("id")
      .eq("job_id", numericJobId as never)
      .limit(1);

    if (!existingItems || existingItems.length === 0) {
      const { data: listingForChecklist } = await supabase
        .from("listings")
        .select("addons, special_areas")
        .eq("id", checkoutJob.listing_id as never)
        .maybeSingle();

      const listingRow = listingForChecklist as {
        addons?: string[] | null;
        special_areas?: string[] | null;
      } | null;
      const addons = (listingRow?.addons ?? []) as string[];
      const isSpecialArea = (key: string) =>
        isSpecialAreaForJobChecklist(listingRow, key);
      const defaultLabels = await loadDefaultCleanerChecklistLabels(supabase);

      const rows: { job_id: number; label: string }[] = [];
      for (const addon of addons) {
        const display = formatListingAddonDisplayName(addon);
        const label = isSpecialArea(addon)
          ? `Special area: ${display.charAt(0).toUpperCase() + display.slice(1)}`
          : `Add-on: ${display}`;
        rows.push({ job_id: numericJobId, label });
      }
      for (const label of defaultLabels) {
        rows.push({ job_id: numericJobId, label });
      }
      if (rows.length > 0) {
        await supabase.from("job_checklist_items").insert(rows as never);
      }
    }

    revalidatePath(`/jobs/${numericJobId}`);
    return { ok: true };
  } catch (e) {
    const err = e as Error & { type?: string; code?: string };
    console.error("[fulfillJobPaymentFromSession] Stripe or update failed", {
      message: err.message,
      code: err.code,
      type: err.type,
    });
    return {
      ok: false,
      error:
        err.message && err.message.length < 200
          ? err.message
          : "Could not confirm payment with Stripe. Try again or contact support.",
    };
  }
}

/**
 * After Stripe Checkout redirect to `/jobs/...?payment=success&session_id=...`, confirm the session
 * server-side. Routes Pay & Start Job (`job_payment`) vs buy-now (`buy_now`) using session metadata.
 */
export async function fulfillStripeCheckoutReturn(
  checkoutSessionId: string
): Promise<FulfillJobPaymentFromSessionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  let stripe: import("stripe").default;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const cs = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["payment_intent"],
    });

    if (cs.mode !== "payment") {
      return { ok: false, error: "Invalid session type." };
    }

    const jobIdMeta = cs.metadata?.job_id ?? cs.client_reference_id;
    if (cs.metadata?.type === "job_top_up") {
      return fulfillJobTopUpFromSession(checkoutSessionId);
    }
    if (jobIdMeta && cs.metadata?.type !== "buy_now") {
      return fulfillJobPaymentFromSession(checkoutSessionId);
    }

    const listingId = cs.metadata?.listing_id;
    if (cs.metadata?.type === "buy_now" && listingId) {
      const pi =
        typeof cs.payment_intent === "string"
          ? await stripe.paymentIntents.retrieve(cs.payment_intent)
          : (cs.payment_intent as Stripe.PaymentIntent | null);
      if (!pi?.id) {
        return { ok: false, error: "No PaymentIntent on session." };
      }

      const { data: jobRows } = await supabase
        .from("jobs")
        .select("id, lister_id, winner_id")
        .eq("listing_id", listingId)
        .limit(1);
      const jobRow = jobRows?.[0] as
        | { id: number | string; lister_id: string; winner_id: string | null }
        | undefined;
      if (!jobRow) {
        return { ok: false, error: "Job not found for this listing." };
      }
      const uid = session.user.id;
      if (uid !== jobRow.lister_id && uid !== jobRow.winner_id) {
        return { ok: false, error: "Not authorized for this payment." };
      }

      const { error } = await supabase
        .from("jobs")
        .update({
          payment_intent_id: pi.id,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("listing_id", listingId);
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath(`/jobs/${listingId}`);
      revalidatePath(`/jobs/${jobRow.id}`);
      return { ok: true };
    }

    if (jobIdMeta) {
      return fulfillJobPaymentFromSession(checkoutSessionId);
    }

    return { ok: false, error: "No job id on session." };
  } catch (e) {
    const err = e as Error & { type?: string; code?: string };
    console.error("[fulfillStripeCheckoutReturn] failed", {
      message: err.message,
      code: err.code,
      type: err.type,
    });
    return {
      ok: false,
      error:
        err.message && err.message.length < 200
          ? err.message
          : "Could not confirm payment with Stripe. Try again or contact support.",
    };
  }
}

/** Ensure default checklist items exist for an in_progress job that has none (e.g. job was set in_progress via webhook). Call from job page so checklist appears. */
export async function ensureJobChecklistIfEmpty(
  jobId: string | number
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, listing_id, lister_id, winner_id")
    .eq("id", numericJobId as never)
    .maybeSingle();

  if (!job) return;

  const checklistJob = job as {
    status: string;
    listing_id: string;
    lister_id: string;
    winner_id: string | null;
  };

  if (checklistJob.status !== "in_progress") return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  if (userId !== checklistJob.lister_id && userId !== checklistJob.winner_id) return;

  const { data: existing } = await supabase
    .from("job_checklist_items")
    .select("id")
    .eq("job_id", numericJobId as never)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: listingForChecklist } = await supabase
    .from("listings")
    .select("addons, special_areas")
    .eq("id", checklistJob.listing_id as never)
    .maybeSingle();
  const listingRow = listingForChecklist as {
    addons?: string[] | null;
    special_areas?: string[] | null;
  } | null;
  const addons = (listingRow?.addons ?? []) as string[];
  const isSpecialArea = (key: string) =>
    isSpecialAreaForJobChecklist(listingRow, key);
  const defaultLabels = await loadDefaultCleanerChecklistLabels(supabase);
  const rows: { job_id: number; label: string }[] = [];
  for (const addon of addons) {
    const display = formatListingAddonDisplayName(addon);
    const label = isSpecialArea(addon)
      ? `Special area: ${display.charAt(0).toUpperCase() + display.slice(1)}`
      : `Add-on: ${display}`;
    rows.push({ job_id: numericJobId, label });
  }
  for (const label of defaultLabels) {
    rows.push({ job_id: numericJobId, label });
  }
  if (rows.length > 0) {
    await supabase.from("job_checklist_items").insert(rows as never);
  }
}

export type ApproveJobStartResult = { ok: true } | { ok: false; error: string };

export async function approveJobStart(
  jobId: string | number
): Promise<ApproveJobStartResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, listing_id, payment_intent_id")
    .eq("id", jobId as never)
    .maybeSingle();

  if (error || !job) {
    return { ok: false, error: "Job not found." };
  }

  const approveRow = job as {
    id: number | string;
    lister_id: string;
    winner_id: string | null;
    status: string;
    listing_id: string;
    payment_intent_id?: string | null;
  };

  if (approveRow.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can approve the job start." };
  }

  if (approveRow.status !== "accepted") {
    return {
      ok: false,
      error: "Job must be in 'accepted' status to approve start.",
    };
  }

  if (!trimStr(approveRow.payment_intent_id)) {
    return {
      ok: false,
      error: "Pay and start the job first (Pay & Start Job) so funds are in escrow.",
    };
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "in_progress", updated_at: new Date().toISOString() } as Partial<JobRow> as never)
    .eq("id", approveRow.id as never);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const numericJobId =
    typeof approveRow.id === "number" ? approveRow.id : Number(approveRow.id);

  const { data: existingItems } = await supabase
    .from("job_checklist_items")
    .select("id")
    .eq("job_id", numericJobId as never)
    .limit(1);

  if (!existingItems || existingItems.length === 0) {
    const { data: listingForChecklist } = await supabase
      .from("listings")
      .select("addons, special_areas")
      .eq("id", approveRow.listing_id as never)
      .maybeSingle();

    const listingRow = listingForChecklist as {
      addons?: string[] | null;
      special_areas?: string[] | null;
    } | null;
    const addons = (listingRow?.addons ?? []) as string[];
    const isSpecialArea = (key: string) =>
      isSpecialAreaForJobChecklist(listingRow, key);

    const defaultLabels = await loadDefaultCleanerChecklistLabels(supabase);

    const rows: {
      job_id: number;
      label: string;
      is_completed?: boolean;
    }[] = [];

    for (const addon of addons) {
      const display = formatListingAddonDisplayName(addon);
      const label = isSpecialArea(addon)
        ? `Special area: ${display.charAt(0).toUpperCase() + display.slice(1)}`
        : `Add-on: ${display}`;
      rows.push({
        job_id: numericJobId,
        label,
      });
    }

    for (const label of defaultLabels) {
      rows.push({
        job_id: numericJobId,
        label,
      });
    }

    if (rows.length > 0) {
      await supabase
        .from("job_checklist_items")
        .insert(rows as never);
    }
  }

  if (approveRow.winner_id) {
    await createNotification(
      approveRow.winner_id,
      "job_accepted",
      typeof approveRow.id === "number" ? approveRow.id : Number(approveRow.id),
      "Job has started. You can begin work."
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${approveRow.id}`);

  return { ok: true };
}

export type CancelJobByListerResult = { ok: true } | { ok: false; error: string };

/**
 * Lister cancels the job before Pay & Start Job (no escrow yet). Notifies cleaner (bell + email).
 * Only allowed when status is "accepted" and there is no payment hold.
 */
export async function cancelJobByLister(
  jobId: string | number
): Promise<CancelJobByListerResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, payment_intent_id")
    .eq("id", numericJobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const cancelRow = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    payment_intent_id?: string | null;
  };

  if (cancelRow.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can cancel this job." };
  }

  if (cancelRow.status !== "accepted") {
    return { ok: false, error: "Job can only be cancelled while it is pending your payment (accepted, before Pay & Start Job)." };
  }

  if (trimStr(cancelRow.payment_intent_id)) {
    return { ok: false, error: "Payment is already held in escrow. To cancel after payment, please open a dispute or contact support." };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "cancelled", updated_at: nowIso } as Partial<JobRow> as never)
    .eq("id", numericJobId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (cancelRow.winner_id) {
    await createNotification(
      cancelRow.winner_id,
      "job_cancelled_by_lister",
      numericJobId,
      "This job listing has been cancelled by the property lister. You have been unassigned from the job."
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${numericJobId}`);

  return { ok: true };
}

export type MarkChecklistFinishedResult =
  | { ok: true }
  | { ok: false; error: string };

export async function markJobChecklistFinished(
  jobId: string | number
): Promise<MarkChecklistFinishedResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  // Load by numeric job id only. Do NOT use `.or(..., listing_id.eq.jobId)` — listing_id is
  // uuid; comparing it to a numeric id string makes Postgres error ("invalid input syntax for type uuid").
  const raw = trimStr(jobId);
  const numericId = Number(raw);
  let jobQuery = supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, auto_release_at, auto_release_at_original"
    );
  if (Number.isFinite(numericId) && numericId > 0 && /^\d+$/.test(raw)) {
    jobQuery = jobQuery.eq("id", numericId);
  } else {
    jobQuery = jobQuery.eq("listing_id", raw);
  }

  const { data: job, error } = await jobQuery.maybeSingle();

  if (error || !job) {
    console.error("markJobChecklistFinished job lookup failed", {
      jobId,
      error,
      job,
    });
    return {
      ok: false,
      error:
        error?.message ??
        "Job not found or you may not have access to it.",
    };
  }

  const row = job as Pick<
    JobRow,
    | "id"
    | "lister_id"
    | "winner_id"
    | "status"
    | "cleaner_confirmed_complete"
    | "cleaner_confirmed_at"
    | "auto_release_at"
    | "auto_release_at_original"
  >;

  if (row.winner_id !== session.user.id) {
    return { ok: false, error: "Only the cleaner can mark tasks finished." };
  }

  const isAlreadyCompletedPending =
    row.status === "completed_pending_approval" &&
    row.cleaner_confirmed_complete &&
    row.cleaner_confirmed_at;

  if (row.status !== "in_progress" && !isAlreadyCompletedPending) {
    return {
      ok: false,
      error: "Job must be in progress to finish the checklist.",
    };
  }

  if (row.status === "in_progress") {
    const jid = typeof row.id === "number" ? row.id : Number(row.id);
    const readyMap = await getCleanerReadyToRequestPaymentByJobId(supabase, [jid]);
    if (!readyMap.get(jid)) {
      return {
        ok: false,
        error:
          "Complete every checklist item and upload at least 3 after-photos before requesting payment.",
      };
    }
  }

  const nowIso = new Date().toISOString();
  const settings = await getGlobalSettings();
  const autoReleaseHours = settings?.auto_release_hours ?? 48;

  // If the cleaner already confirmed completion earlier, keep the same baseline
  // using `cleaner_confirmed_at` rather than "now".
  const baselineIso = row.cleaner_confirmed_at ?? nowIso;
  const baselineMs = new Date(baselineIso).getTime();
  const autoReleaseAtIso = new Date(
    baselineMs + autoReleaseHours * 60 * 60 * 1000
  ).toISOString();

  if (
    isAlreadyCompletedPending &&
    row.auto_release_at &&
    row.auto_release_at_original
  ) {
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update(
      {
        cleaner_confirmed_complete: true,
        cleaner_confirmed_at: row.cleaner_confirmed_at ?? nowIso,
        status: "completed_pending_approval",
        auto_release_at: autoReleaseAtIso,
        auto_release_at_original: autoReleaseAtIso,
        // completed_at is set when payment is released (status completed), not at review-pending.
      } as Partial<JobRow> as never
    )
    .eq("id", row.id as never);

  if (updateError) {
    return {
      ok: false,
      error:
        updateError.message +
        (updateError.message.includes("jobs_status_check") || updateError.message.includes("check constraint")
          ? " If you recently added a DB status check, ensure it allows status `completed_pending_approval`."
          : ""),
    };
  }

  if (row.lister_id) {
    await createNotification(
      row.lister_id,
      "job_completed",
      typeof row.id === "number" ? row.id : Number(row.id),
      "The cleaner marked the job complete and requested payment. Review after photos and release funds, or wait for auto-release."
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/cleaner/dashboard");
  revalidatePath(`/jobs/${row.id}`);

  return { ok: true };
}

export type ReleaseJobFundsResult =
  | { ok: true; transferId?: string; paymentIntentId?: string }
  | { ok: false; error: string };

/**
 * Capture PaymentIntent and transfer job price to cleaner's Stripe Connect account.
 * Idempotent: if payment_released_at already set, no-op. Callable by finalizeJobPayment or auto-release.
 */
export async function releaseJobFunds(
  jobId: string | number,
  options?: { supabase?: SupabaseClient<Database> }
): Promise<ReleaseJobFundsResult> {
  const supabase = (options?.supabase ??
    (await createServerSupabaseClient())) as SupabaseClient<Database>;
  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(
      "id, listing_id, payment_intent_id, agreed_amount_cents, winner_id, payment_released_at, stripe_transfer_id, top_up_payments"
    )
    .eq("id", numericJobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const j = job as {
    listing_id: string | null;
    payment_intent_id: string | null;
    agreed_amount_cents: number | null;
    winner_id: string | null;
    payment_released_at: string | null;
    stripe_transfer_id: string | null;
    top_up_payments?: unknown;
  };

  if (j.payment_released_at) {
    return { ok: true };
  }

  if (!trimStr(j.payment_intent_id)) {
    return { ok: false, error: "Job has no payment hold (payment_intent_id)." };
  }

  const agreedCentsTotal = j.agreed_amount_cents ?? 0;
  if (agreedCentsTotal < 1) {
    return { ok: false, error: "Job has no agreed amount." };
  }

  if (!trimStr(j.winner_id)) {
    return { ok: false, error: "Job has no cleaner (winner_id)." };
  }
  const winnerId = trimStr(j.winner_id);

  const legs = buildEscrowReleaseLegs({
    paymentIntentId: j.payment_intent_id,
    agreedAmountCents: j.agreed_amount_cents,
    topUpPaymentsRaw: j.top_up_payments as never,
  });
  if (!legs?.length) {
    return {
      ok: false,
      error:
        "Could not align escrow payments with the job total. If you used top-ups, contact support.",
    };
  }

  /** RLS usually allows users to read only their own profile; listers cannot read the cleaner's row. */
  const adminForPayout = createSupabaseAdminClient();
  const profileClient = adminForPayout ?? supabase;
  const { data: profile } = await profileClient
    .from("profiles")
    .select("stripe_connect_id, stripe_onboarding_complete")
    .eq("id", winnerId)
    .maybeSingle();

  const globalForRelease = await getGlobalSettings();
  if (globalForRelease?.require_stripe_connect_before_payment_release !== false) {
    if (!isProfileStripePayoutReady(profile)) {
      return {
        ok: false,
        error:
          "The cleaner has not finished Stripe payout setup. They must connect their bank account before escrow can be released.",
      };
    }
  }

  const stripeConnectIdRaw = (profile as { stripe_connect_id?: string | null } | null)?.stripe_connect_id;
  if (!trimStr(stripeConnectIdRaw)) {
    return { ok: false, error: "Cleaner has not connected a bank account (Stripe Connect)." };
  }
  const stripeConnectId = trimStr(stripeConnectIdRaw);

  let stripe;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const connectReady = await ensureConnectAccountCanReceiveTransfers(
      stripe,
      stripeConnectId
    );
    if (!connectReady.ok) {
      return { ok: false, error: connectReady.error };
    }

    const transferIds: string[] = [];
    let updatedTopUps = parseJobTopUpPayments(j.top_up_payments as never);

    for (const leg of legs) {
      const pi = await stripe.paymentIntents.retrieve(leg.paymentIntentId);
      if (pi.status === "requires_action") {
        return {
          ok: false,
          error:
            "This payment requires authentication (e.g. 3D Secure). Please complete verification from your payment method or use a different card, then try again.",
        };
      }
      if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
        return {
          ok: false,
          error: `Payment cannot be released yet (status: ${pi.status}). Please ensure every payment was completed successfully.`,
        };
      }

      let chargeId: string | undefined;
      if (pi.status === "requires_capture") {
        const captured = await stripe.paymentIntents.capture(leg.paymentIntentId);
        chargeId =
          typeof captured.latest_charge === "string"
            ? captured.latest_charge
            : (captured.latest_charge as { id?: string } | null)?.id;
      } else if (pi.status === "succeeded") {
        chargeId =
          typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : (pi.latest_charge as { id?: string } | null)?.id;
      }

      const transferParams: {
        amount: number;
        currency: string;
        destination: string;
        metadata: { job_id: string; leg?: string };
        source_transaction?: string;
      } = {
        amount: Math.max(1, leg.agreedCents),
        currency: "aud",
        destination: stripeConnectId,
        metadata: {
          job_id: String(numericJobId),
          leg: leg.topUpIndex < 0 ? "primary" : `top_up_${leg.topUpIndex}`,
        },
      };
      if (chargeId) transferParams.source_transaction = chargeId;

      const transfer = await stripe.transfers.create(transferParams);
      transferIds.push(transfer.id);

      if (leg.topUpIndex >= 0 && updatedTopUps[leg.topUpIndex]) {
        updatedTopUps = updatedTopUps.map((row, idx) =>
          idx === leg.topUpIndex ? { ...row, stripe_transfer_id: transfer.id } : row
        );
      }
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        payment_released_at: nowIso,
        stripe_transfer_id: transferIds.join(","),
        top_up_payments: updatedTopUps as unknown as never,
        updated_at: nowIso,
      } as never)
      .eq("id", numericJobId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    const testMode = await isStripeTestMode();
    if (testMode) {
      console.log(
        "[Stripe Test] Multi-leg release:",
        legs.map((l) => l.paymentIntentId),
        "Transfers:",
        transferIds
      );
    }
    return {
      ok: true,
      ...(testMode
        ? {
            transferId: transferIds[transferIds.length - 1],
            paymentIntentId: legs[0]?.paymentIntentId,
          }
        : {}),
    };
  } catch (e) {
    const err = e as Error & { type?: string; code?: string; raw?: { message?: string } };
    let message =
      err.raw?.message ?? err.message ?? "Failed to capture or transfer.";
    if (
      typeof message === "string" &&
      message.includes("destination account needs to have at least one of the following capabilities")
    ) {
      message =
        "The cleaner's Stripe account is not ready to receive this payout. They should complete Connect onboarding under Profile / Settings → Payouts and wait until Stripe finishes verification, then try again.";
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[releaseJobFunds] Stripe error:", err.type, err.code, message);
    }
    return { ok: false, error: message };
  }
}

/**
 * Escrow flow aliases for documentation and callers:
 * - createPaymentIntent: creates Stripe Checkout for "Pay & Start Job" (PaymentIntent with capture_method=manual).
 * - captureAndTransfer: captures the PaymentIntent and transfers job amount to cleaner's Stripe Connect account (minus platform fee).
 */
export const createPaymentIntent = createJobCheckoutSession;
export const captureAndRelease = releaseJobFunds;
// Backwards-compatible alias
export const captureAndTransfer = releaseJobFunds;

export type ExecuteRefundResult = { ok: true } | { ok: false; error: string };

/**
 * Refund amount (cents) to the lister via Stripe; optionally reverse transfer from cleaner.
 * Call after dispute resolution (acceptRefund / acceptCounterRefund). Idempotent for 0 amount.
 */
export async function executeRefund(
  jobId: number,
  refundCents: number
): Promise<ExecuteRefundResult> {
  if (refundCents < 1) return { ok: true };

  const supabase = await createServerSupabaseClient();
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(
      "id, listing_id, payment_intent_id, agreed_amount_cents, stripe_transfer_id, payment_released_at"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) return { ok: false, error: "Job not found." };
  const j = job as {
    listing_id: string | null;
    payment_intent_id: string | null;
    agreed_amount_cents: number | null;
    stripe_transfer_id: string | null;
    payment_released_at: string | null;
  };

  if (!trimStr(j.payment_intent_id)) {
    return { ok: false, error: "Job has no payment hold; cannot process Stripe refund." };
  }
  const paymentIntentId = trimStr(j.payment_intent_id);

  const agreedCents = j.agreed_amount_cents ?? 0;
  const settings = await getGlobalSettings();
  const feePct =
    (await fetchPlatformFeePercentForListing(supabase, j.listing_id, settings)) / 100;
  const feeCents = Math.round(agreedCents * feePct);
  const chargeTotalCents = agreedCents + feeCents;
  const amount = Math.min(refundCents, Math.max(1, chargeTotalCents));

  let stripe;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    // Ensure funds are captured before creating a refund. (Manual capture escrow holds until release/dispute resolution.)
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status === "requires_capture") {
      await stripe.paymentIntents.capture(paymentIntentId);
    }

    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason: "requested_by_customer",
      metadata: { job_id: String(jobId) },
    });

    const stripeTransferId = trimStr(j.stripe_transfer_id);
    if (stripeTransferId && amount > feeCents && agreedCents >= 1) {
      const reverseCents = Math.min(agreedCents, amount - feeCents);
      if (reverseCents >= 1) {
        await stripe.transfers.createReversal(stripeTransferId, {
          amount: reverseCents,
          metadata: { job_id: String(jobId), reason: "dispute_partial_refund" },
        });
      }
    }

    return { ok: true };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message ?? "Stripe refund failed." };
  }
}

export type FinalizeJobPaymentResult =
  | { ok: true; transferId?: string; paymentIntentId?: string }
  | { ok: false; error: string };

/**
 * Lister approves and releases funds from escrow: capture PaymentIntent, transfer to cleaner, mark job completed.
 * Requires cleaner to have marked job complete (photos/checklist). Pay & Start Job must have run first (funds in escrow).
 */
export async function finalizeJobPayment(
  jobId: string | number
): Promise<FinalizeJobPaymentResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, cleaner_confirmed_complete, listing_id, agreed_amount_cents"
    )
    .eq("id", jobId as never)
    .maybeSingle();

  if (error || !job) {
    return { ok: false, error: "Job not found." };
  }

  const row = job as Pick<
    JobRow,
    | "id"
    | "lister_id"
    | "winner_id"
    | "status"
    | "cleaner_confirmed_complete"
    | "listing_id"
    | "agreed_amount_cents"
  >;

  if (row.lister_id !== user.id) {
    return { ok: false, error: "Only the lister can finalize payment." };
  }

  if (
    row.status !== "in_progress" &&
    row.status !== "completed_pending_approval"
  ) {
    return {
      ok: false,
      error: "Job must be pending approval/in progress to finalize payment.",
    };
  }

  const numericJobId =
    typeof row.id === "number" ? row.id : Number(row.id);

  /** Bypass RLS for job-scoped reads once lister is authorized (same as releaseJobFunds payout lookup). */
  const admin = createSupabaseAdminClient();
  const gatedClient = (admin ?? supabase) as SupabaseClient<Database>;

  // New flow: ready for release when checklist is complete and 3+ after-photos are uploaded
  // (no separate "mark complete" action; cleaner completing checklist + photos is enough)
  const { data: items, error: checklistError } = await gatedClient
    .from("job_checklist_items")
    .select("is_completed")
    .eq("job_id", numericJobId as never);

  if (checklistError) {
    return { ok: false, error: checklistError.message };
  }

  const allCompleted =
    (items ?? []).length > 0 &&
    (items ?? []).every((row: { is_completed: boolean }) => row.is_completed);

  if (!allCompleted) {
    return {
      ok: false,
      error:
        "All checklist tasks must be completed before payment can be finalized.",
    };
  }

  // Require at least 3 after-photos (new flow: no separate "mark complete" button)
  const { data: afterFiles, error: afterError } = await gatedClient.storage
    .from("condition-photos")
    .list(`jobs/${numericJobId}/after`, { limit: 100 });
  if (afterError) {
    return { ok: false, error: afterError.message };
  }
  const afterCount = (afterFiles ?? []).filter(
    (f) => f.name && !f.name.startsWith("thumb_")
  ).length;
  if (afterCount < 3) {
    return {
      ok: false,
      error:
        "At least 3 after-photos must be uploaded before you can release payment.",
    };
  }

  const settingsForRelease = await getGlobalSettings();
  if (
    settingsForRelease?.require_stripe_connect_before_payment_release !== false &&
    row.winner_id
  ) {
    const adminForWinner = createSupabaseAdminClient();
    if (!adminForWinner) {
      return {
        ok: false,
        error: "Cannot verify cleaner payout status. Try again later or contact support.",
      };
    }
    const { data: winnerProf } = await adminForWinner
      .from("profiles")
      .select("stripe_connect_id, stripe_onboarding_complete")
      .eq("id", row.winner_id)
      .maybeSingle();
    if (!isProfileStripePayoutReady(winnerProf)) {
      const msg =
        "The assigned cleaner must complete Stripe payout setup before funds can be released. They can finish this under Profile → Payments.";
      const dup = await hasRecentJobNotification(
        user.id,
        "lister_payout_blocked_cleaner_stripe",
        numericJobId,
        24
      );
      if (!dup) {
        try {
          await createNotification(
            user.id,
            "lister_payout_blocked_cleaner_stripe",
            numericJobId,
            msg
          );
        } catch (e) {
          console.error("[finalizeJobPayment] notify lister stripe blocked", e);
        }
      }
      return { ok: false, error: msg };
    }
  }

  const releaseResult = await releaseJobFunds(numericJobId);
  if (!releaseResult.ok) {
    return { ok: false, error: releaseResult.error };
  }

  const debugPayload =
    "transferId" in releaseResult || "paymentIntentId" in releaseResult
      ? { transferId: releaseResult.transferId, paymentIntentId: releaseResult.paymentIntentId }
      : undefined;

  const updatePayload: Partial<JobRow> & { status: string } = { status: "completed" };
  if (!row.cleaner_confirmed_complete) {
    (updatePayload as Record<string, unknown>).cleaner_confirmed_complete = true;
    (updatePayload as Record<string, unknown>).cleaner_confirmed_at = new Date().toISOString();
  }
  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", row.id as never);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (row.listing_id) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", row.listing_id as never);
  }

  if (row.winner_id) {
    const agreedCentsForSms = row.agreed_amount_cents ?? 0;
    await createNotification(
      row.winner_id,
      "payment_released",
      numericJobId,
      "Payment has been released. Funds are on the way to your connected bank account.",
      { amountCents: agreedCentsForSms }
    );
  }

  if (row.lister_id) {
    const agreedCentsLister = row.agreed_amount_cents ?? 0;
    await createNotification(
      row.lister_id,
      "payment_released",
      numericJobId,
      "Funds have been released from escrow to the cleaner. Thank you for using Bond Back.",
      { amountCents: agreedCentsLister }
    );
  }

  const agreedCents = row.agreed_amount_cents ?? 0;
  if (agreedCents >= 1 && row.lister_id) {
    const settings = await getGlobalSettings();
    let jobTitle: string | null = null;
    let feePct = (settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12) / 100;
    if (row.listing_id) {
      const { data: listing } = await supabase
        .from("listings")
        .select("title, platform_fee_percentage")
        .eq("id", row.listing_id)
        .maybeSingle();
      const lr = listing as { title?: string; platform_fee_percentage?: number | null } | null;
      jobTitle = lr?.title ?? null;
      feePct =
        resolvePlatformFeePercent(lr?.platform_fee_percentage, settings) / 100;
    }
    const feeCents = Math.round(agreedCents * feePct);
    const totalCents = agreedCents + feeCents;
    await sendPaymentReceiptEmails({
      jobId: numericJobId,
      listerId: row.lister_id,
      cleanerId: row.winner_id,
      amountCents: totalCents,
      feeCents,
      netCents: agreedCents,
      jobTitle,
      dateIso: new Date().toISOString(),
    });
  }

  if (row.winner_id) await recomputeVerificationBadgesForUser(row.winner_id);
  if (row.lister_id) await recomputeVerificationBadgesForUser(row.lister_id);

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${row.id}`);

  return { ok: true, ...debugPayload };
}

export type ProcessAutoReleaseResult = {
  processed: number;
  jobIds: number[];
  errors?: string[];
};

/**
 * Find jobs where the cleaner marked complete but the lister did not approve within
 * auto_release_hours; capture and transfer funds, then mark job completed.
 * Call from cron (e.g. GET/POST /api/cron/auto-release).
 */
export async function processAutoRelease(): Promise<ProcessAutoReleaseResult> {
  const admin = createSupabaseAdminClient();
  const settings = await getGlobalSettings();
  const autoReleaseHours = settings?.auto_release_hours ?? 0;
  const manualPayoutMode = settings?.manual_payout_mode ?? false;

  if (!admin) {
    return {
      processed: 0,
      jobIds: [],
      errors: ["SUPABASE_SERVICE_ROLE_KEY not set; cron cannot read/update jobs."],
    };
  }

  if (manualPayoutMode || !autoReleaseHours || autoReleaseHours < 1) {
    return { processed: 0, jobIds: [] };
  }

  // Only jobs awaiting lister approval — not in_progress (implicit timer without a row is unsupported).
  // Paused timers: both auto_release_at and auto_release_at_original null (e.g. after dispute).
  const { data: jobs, error } = await admin
    .from("jobs")
    .select(
      "id, listing_id, lister_id, winner_id, agreed_amount_cents, auto_release_at, auto_release_at_original, cleaner_confirmed_at"
    )
    .eq("status", "completed_pending_approval")
    .eq("cleaner_confirmed_complete", true)
    .is("payment_released_at", null);

  if (error) {
    return { processed: 0, jobIds: [], errors: [error.message] };
  }

  const list = (jobs ?? []) as {
    id: number;
    listing_id: string | null;
    lister_id: string;
    winner_id: string | null;
    agreed_amount_cents?: number | null;
    auto_release_at?: string | null;
    auto_release_at_original?: string | null;
    cleaner_confirmed_at?: string | null;
  }[];

  const nowMs = Date.now();
  const getReleaseAtMs = (job: typeof list[number]) => {
    const atIso = job.auto_release_at ?? job.auto_release_at_original;
    if (!atIso) return null;
    return new Date(atIso).getTime();
  };

  const dueJobs = list.filter((job) => {
    const releaseAtMs = getReleaseAtMs(job);
    return releaseAtMs != null && releaseAtMs <= nowMs;
  });
  const jobIds: number[] = [];
  const errors: string[] = [];

  for (const job of dueJobs) {
    const releaseResult = await releaseJobFunds(job.id, { supabase: admin });
    if (!releaseResult.ok) {
      errors.push(`Job ${job.id}: ${releaseResult.error}`);
      continue;
    }

    const completionIso = new Date().toISOString();
    const { error: updateError } = await admin
      .from("jobs")
      .update(
        { status: "completed", completed_at: completionIso } as Partial<JobRow> as never
      )
      .eq("id", job.id);

    if (updateError) {
      errors.push(`Job ${job.id} status: ${updateError.message}`);
    }

    if (job.listing_id) {
      await admin
        .from("listings")
        .update({ status: "ended" } as never)
        .eq("id", job.listing_id);
    }

    if (job.winner_id) {
      await createNotification(
        job.winner_id,
        "payment_released",
        job.id,
        "Funds auto-released (review window elapsed). Payment is on the way to your connected account.",
        { amountCents: job.agreed_amount_cents ?? undefined }
      );
    }
    if (job.lister_id) {
      await createNotification(
        job.lister_id,
        "payment_released",
        job.id,
        "Funds were automatically released from escrow (review window elapsed).",
        { amountCents: job.agreed_amount_cents ?? undefined }
      );
    }

    const agreedCents = job.agreed_amount_cents ?? 0;
    if (agreedCents >= 1 && job.lister_id) {
      let feePct =
        (settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12) / 100;
      let jobTitle: string | null = null;
      if (job.listing_id) {
        const { data: listing } = await admin
          .from("listings")
          .select("title, platform_fee_percentage")
          .eq("id", job.listing_id)
          .maybeSingle();
        const lr = listing as { title?: string; platform_fee_percentage?: number | null } | null;
        jobTitle = lr?.title ?? null;
        feePct = resolvePlatformFeePercent(lr?.platform_fee_percentage, settings) / 100;
      }
      const feeCents = Math.round(agreedCents * feePct);
      const totalCents = agreedCents + feeCents;
      await sendPaymentReceiptEmails({
        jobId: job.id,
        listerId: job.lister_id,
        cleanerId: job.winner_id,
        amountCents: totalCents,
        feeCents,
        netCents: agreedCents,
        jobTitle,
        dateIso: new Date().toISOString(),
      });
    }

    if (job.winner_id) await recomputeVerificationBadgesForUser(job.winner_id);
    if (job.lister_id) await recomputeVerificationBadgesForUser(job.lister_id);

    await applyReferralRewardsForCompletedJob(job.id);

    jobIds.push(job.id);
  }

  if (jobIds.length) {
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
  }

  return {
    processed: jobIds.length,
    jobIds,
    ...(errors.length ? { errors } : {}),
  };
}

/** Alias for cron stubs / manual triggers — identical to {@link processAutoRelease}. */
export const runAutoReleaseCheck = processAutoRelease;

export type ProcessAutoDisputeEscalationResult = {
  processed: number;
  jobIds: number[];
  errors?: string[];
};

/**
 * Auto-escalate disputes to admin review after 72 hours without agreement.
 * Sets job.status -> 'in_review' and notifies admins via `notifications` table.
 * Call from cron (e.g. /api/cron/auto-dispute-escalation).
 */
export async function processAutoDisputeEscalation(): Promise<ProcessAutoDisputeEscalationResult> {
  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  const escalationHours = 72;

  if (!admin) {
    return { processed: 0, jobIds: [], errors: ["Admin client not configured."] };
  }

  const cutoff = new Date(
    Date.now() - escalationHours * 60 * 60 * 1000
  ).toISOString();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, status, disputed_at, payment_released_at")
    .in("status", ["disputed", "dispute_negotiating"])
    .lte("disputed_at", cutoff);

  if (error) {
    return { processed: 0, jobIds: [], errors: [error.message] };
  }

  const list = (jobs ?? []) as {
    id: number;
    status: string;
    disputed_at?: string | null;
    payment_released_at?: string | null;
  }[];

  const adminUserIds: string[] = [];
  const { data: adminProfiles } = await admin
    .from("profiles")
    .select("id, is_admin")
    .eq("is_admin", true);
  (adminProfiles ?? []).forEach((p: any) => {
    if (p?.id) adminUserIds.push(p.id);
  });

  const jobIds: number[] = [];
  const errors: string[] = [];
  const nowIso = new Date().toISOString();

  for (const job of list) {
    if (job.payment_released_at) continue;

    const { error: updateErr } = await admin
      .from("jobs")
      .update({ status: "in_review", dispute_status: "in_review" } as Partial<JobRow> as never)
      .eq("id", job.id);
    if (updateErr) {
      errors.push(`Job ${job.id}: ${updateErr.message}`);
      continue;
    }

    if (adminUserIds.length) {
      try {
        await admin.from("notifications").insert(
          adminUserIds.map((adminId) => ({
            user_id: adminId,
            type: "dispute_opened",
            job_id: job.id,
            message_text: `Dispute auto-escalated for admin review (no agreement after ${escalationHours} hours). Job #${job.id}.`,
          })) as any
        );
      } catch {
        // Swallow notification failures (audit + status update still done).
      }
    }

    jobIds.push(job.id);
  }

  return { processed: jobIds.length, jobIds, ...(errors.length ? { errors } : {}) };
}

export type OpenDisputeResult = { ok: true } | { ok: false; error: string };

export type OpenDisputePayload = {
  reason: string;
  reasonOther?: string;
  photoUrls: string[];
  message?: string;
  /** When lister opens dispute: proposed partial refund in cents. If > 0, status becomes dispute_negotiating. */
  proposedRefundCents?: number;
};

/**
 * Open a dispute on a completed job. Caller must be the lister or the cleaner (winner).
 * Sets job status to 'disputed', stores reason and evidence photos, notifies the other party.
 */
export async function openDispute(
  jobId: number,
  payload: OpenDisputePayload
): Promise<OpenDisputeResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, listing_id, status, cleaner_confirmed_complete")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const j = job as {
    id: number;
    lister_id: string;
    winner_id: string | null;
    status: string;
    cleaner_confirmed_complete?: boolean;
  };
  const canDispute =
    j.status === "completed" ||
    j.status === "completed_pending_approval" ||
    (j.status === "in_progress" && j.cleaner_confirmed_complete === true);
  if (!canDispute) {
    return { ok: false, error: "Disputes are only available after the cleaner marks the job complete (or on completed jobs)." };
  }

  const isLister = session.user.id === j.lister_id;
  const isCleaner = session.user.id === j.winner_id;
  if (!isLister && !isCleaner) {
    return { ok: false, error: "You are not part of this job." };
  }

  const photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls.slice(0, 5) : [];
  if (photoUrls.length < 1) {
    return { ok: false, error: "At least one evidence photo is required." };
  }

  const proposedRefundCents = typeof payload.proposedRefundCents === "number" && payload.proposedRefundCents > 0
    ? payload.proposedRefundCents
    : null;

  const reasonText =
    payload.reason === "other" && trimStr(payload.reasonOther)
      ? `Other: ${trimStr(payload.reasonOther)}`
      : payload.reason;
  const fullReason =
    trimStr(payload.message)
      ? `${reasonText}\n\nAdditional details: ${trimStr(payload.message)}`
      : reasonText;

  const nowIso = new Date().toISOString();
  const updatePayload = {
    status: "disputed",
    dispute_reason: fullReason,
    dispute_photos: photoUrls, // legacy
    dispute_evidence: photoUrls,
    dispute_opened_by: session.user.id,
    disputed_at: nowIso,
    dispute_status: "disputed",
    dispute_cleaner_counter_used: false,
    dispute_lister_counter_used: false,
    admin_mediation_requested: false,
    admin_mediation_requested_at: null as string | null,
    /** Pause auto-release until dispute is resolved */
    auto_release_at: null as string | null,
    auto_release_at_original: null as string | null,
    ...(isLister && proposedRefundCents != null
      ? { proposed_refund_amount: proposedRefundCents, counter_proposal_amount: null }
      : {}),
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const openerRole = isLister ? "lister" : "cleaner";
  let threadBody = `Dispute opened (${openerRole})\n\n${fullReason}`;
  if (isLister && proposedRefundCents != null && proposedRefundCents > 0) {
    threadBody += `\n\nProposed refund to lister: $${(proposedRefundCents / 100).toFixed(2)} AUD`;
  }
  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: openerRole,
    body: threadBody,
    attachmentUrls: photoUrls,
  });

  after(async () => {
    const { notifyAdminDisputeOpened } = await import("@/lib/actions/admin-notify-email");
    await notifyAdminDisputeOpened(jobId).catch(() => {});
  });

  const otherUserId = isLister ? j.winner_id : j.lister_id;
  const reasonSnippet = fullReason.length > 150 ? `${fullReason.slice(0, 147)}…` : fullReason;
  if (otherUserId) {
    const msg =
      `A dispute has been opened on this job. Auto-release is paused. You have 72 hours to respond. Reason: ${reasonSnippet}`;
    await createNotification(otherUserId, "dispute_opened", jobId, msg);
    await sendDisputeActivityEmail({
      jobId,
      toUserId: otherUserId,
      subject: `[Bond Back] Dispute opened — job #${jobId}`,
      htmlBody: `<p>A dispute was opened on <strong>job #${jobId}</strong>. Auto-release is paused.</p><p style="white-space:pre-wrap;">${escapeHtmlForEmail(fullReason)}</p>${disputeHubLinksHtml(jobId)}`,
    });
  }
  await createNotification(
    session.user.id,
    "dispute_opened",
    jobId,
    "Your dispute was submitted. The review timer is paused until the dispute is resolved."
  );

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/my-listings");
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");

  return { ok: true };
}

export type ExtendListerReviewResult =
  | { ok: true; newAutoReleaseAt: string }
  | { ok: false; error: string };

/**
 * Lister-only: extend the auto-release deadline by 24 hours once per job.
 */
export async function extendListerReview24h(
  jobId: number
): Promise<ExtendListerReviewResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, auto_release_at, review_extension_used_at"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return { ok: false, error: "Job not found." };
  }

  const row = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    auto_release_at: string | null;
    review_extension_used_at?: string | null;
  };

  if (row.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can extend the review window." };
  }
  if (row.status !== "completed_pending_approval") {
    return { ok: false, error: "This job is not awaiting your approval." };
  }
  if (row.review_extension_used_at) {
    return { ok: false, error: "You have already used this one-time extension." };
  }
  if (!trimStr(row.auto_release_at)) {
    return {
      ok: false,
      error: "No active review timer is set (cannot extend when auto-release is paused).",
    };
  }
  const autoReleaseAt = trimStr(row.auto_release_at);

  const prev = new Date(autoReleaseAt).getTime();
  const newIso = new Date(prev + 24 * 60 * 60 * 1000).toISOString();
  const usedIso = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("jobs")
    .update(
      {
        auto_release_at: newIso,
        auto_release_at_original: newIso,
        review_extension_used_at: usedIso,
      } as Partial<JobRow> as never
    )
    .eq("id", jobId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await logTimerActivity({
    actorUserId: session.user.id,
    actionType: "lister_extend_review_24h",
    jobId,
    details: {
      prev_auto_release_at: row.auto_release_at,
      new_auto_release_at: newIso,
    },
  });

  await createNotification(
    row.lister_id,
    "job_status_update",
    jobId,
    "You extended the review window by 24 hours."
  );
  if (row.winner_id) {
    await createNotification(
      row.winner_id,
      "job_status_update",
      jobId,
      "The lister extended the review window by 24 hours before auto-release."
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/my-listings");

  return { ok: true, newAutoReleaseAt: newIso };
}

export type AcceptRefundResult = { ok: true } | { ok: false; error: string };

/**
 * Cleaner accepts the lister's proposed partial refund. Releases agreed net to cleaner, completes job.
 */
export async function acceptRefund(jobId: number): Promise<AcceptRefundResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, dispute_opened_by, proposed_refund_amount, listing_id")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as { lister_id: string; winner_id: string | null; status: string; dispute_opened_by?: string | null; proposed_refund_amount?: number | null };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (!disputeOpenedByLister(j)) return { ok: false, error: "Only the lister can propose a refund; this flow is for the cleaner to accept." };
  if (session.user.id !== j.winner_id) return { ok: false, error: "Only the cleaner can accept the refund." };

  const refundCents = j.proposed_refund_amount ?? 0;
  if (refundCents < 1) return { ok: false, error: "No proposed refund amount available to accept." };
  const nowIso = new Date().toISOString();
  const updatePayload = {
    status: "completed",
    dispute_resolution: "partial_refund_accepted",
    resolution_type: "release_after_partial_refund",
    resolution_at: nowIso,
    resolution_by: session.user.id,
    counter_proposal_amount: null,
    dispute_status: "completed",
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) return { ok: false, error: updateError.message };

  const refundResult = await executeRefund(jobId, refundCents);
  if (!refundResult.ok) {
    return { ok: false, error: refundResult.error };
  }

  {
    const { error: refundPersistErr } = await supabase
      .from("jobs")
      .update({ refund_amount: refundCents } as Partial<JobRow> as never)
      .eq("id", jobId);
    if (refundPersistErr) {
      console.error("[acceptRefund] persist refund_amount", refundPersistErr);
    }
  }

  const listingIdForJob =
    (job as { listing_id?: string | number | null }).listing_id ?? null;
  if (listingIdForJob) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", listingIdForJob as never);
  }

  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: "cleaner",
    body: `Accepted lister’s refund proposal: $${(refundCents / 100).toFixed(2)} AUD returned to lister. Job completed.`,
  });

  if (j.lister_id) {
    await createNotification(j.lister_id, "payment_released", jobId, `Cleaner accepted partial refund of $${(refundCents / 100).toFixed(0)}. Job completed.`);
    await sendDisputeActivityEmail({
      jobId,
      toUserId: j.lister_id,
      subject: `[Bond Back] Job #${jobId}: refund accepted — completed`,
      htmlBody: `<p>The cleaner accepted your partial refund request. <strong>$${(refundCents / 100).toFixed(2)}</strong> will be processed per your payment method.</p>${disputeHubLinksHtml(jobId)}`,
    });
  }
  if (j.winner_id) {
    await createNotification(j.winner_id, "payment_released", jobId, "You accepted the partial refund. Refund has been processed.");
  }
  if (refundCents >= 1 && j.lister_id) {
    const listingIdForJob = (job as { listing_id?: string | number | null }).listing_id ?? null;
    let jobTitle: string | null = null;
    if (listingIdForJob) {
      const { data: listing } = await supabase
        .from("listings")
        .select("title")
        .eq("id", listingIdForJob)
        .maybeSingle();
      jobTitle = (listing as { title?: string } | null)?.title ?? null;
    }
    await sendRefundReceiptEmail({
      jobId,
      listerId: j.lister_id,
      refundCents,
      jobTitle,
      dateIso: nowIso,
    });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  return { ok: true };
}

export type CounterRefundPayload = { amountCents: number; message?: string; photoUrls?: string[] };
export type CounterRefundResult = { ok: true } | { ok: false; error: string };

/**
 * Cleaner counters with a different refund amount. Stores counter_proposal_amount, notifies lister.
 */
export async function counterRefund(jobId: number, payload: CounterRefundPayload): Promise<CounterRefundResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, dispute_opened_by, proposed_refund_amount, dispute_cleaner_counter_used")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    dispute_opened_by?: string;
    proposed_refund_amount?: number | null;
    dispute_cleaner_counter_used?: boolean | null;
  };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (session.user.id !== j.winner_id) return { ok: false, error: "Only the cleaner can counter." };
  if (j.dispute_cleaner_counter_used === true) {
    return { ok: false, error: "You have already used your counter-offer for this dispute." };
  }

  const amountCents = Math.max(0, Math.round(payload.amountCents));
  const responseMessage = trimStr(payload.message) || null;
  const responsePhotos =
    Array.isArray(payload.photoUrls) && payload.photoUrls.length > 0
      ? payload.photoUrls.slice(0, 5)
      : undefined;

  const updatePayload: Record<string, unknown> = {
    counter_proposal_amount: amountCents,
    dispute_cleaner_counter_used: true,
    dispute_status: "disputed",
    dispute_response_reason: "Counter offer",
    dispute_response_message: responseMessage,
  };
  if (responsePhotos) {
    updatePayload.dispute_response_evidence = responsePhotos;
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) return { ok: false, error: updateError.message };

  let counterBody = `Counter-offer: partial refund to lister of $${(amountCents / 100).toFixed(2)} AUD`;
  if (responseMessage) counterBody += `\n\n${responseMessage}`;
  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: "cleaner",
    body: counterBody,
    attachmentUrls: responsePhotos ?? [],
  });

  if (j.lister_id) {
    await createNotification(
      j.lister_id,
      "dispute_opened",
      jobId,
      `Cleaner countered with partial refund of $${(amountCents / 100).toFixed(0)}. You can accept or respond on the job page.`
    );
    await sendDisputeActivityEmail({
      jobId,
      toUserId: j.lister_id,
      subject: `[Bond Back] Job #${jobId}: cleaner counter-offer`,
      htmlBody: `<p>The cleaner proposed a different partial refund: <strong>$${(amountCents / 100).toFixed(2)}</strong> back to you.</p>${
        responseMessage
          ? `<p style="white-space:pre-wrap;">${escapeHtmlForEmail(responseMessage)}</p>`
          : ""
      }${disputeHubLinksHtml(jobId)}`,
    });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/disputes");
  return { ok: true };
}

export type ListerCounterRefundPayload = { amountCents: number; message?: string };
export type ListerCounterRefundResult = { ok: true } | { ok: false; error: string };

/**
 * Lister’s single counter-offer back to the cleaner (after cleaner countered). Updates proposed refund and clears counter.
 */
export async function listerCounterRefund(
  jobId: number,
  payload: ListerCounterRefundPayload
): Promise<ListerCounterRefundResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, counter_proposal_amount, agreed_amount_cents, dispute_lister_counter_used"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    counter_proposal_amount?: number | null;
    agreed_amount_cents?: number | null;
    dispute_lister_counter_used?: boolean | null;
  };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (session.user.id !== j.lister_id) return { ok: false, error: "Only the lister can send this counter." };
  const prevCounter = j.counter_proposal_amount ?? 0;
  if (prevCounter < 1) return { ok: false, error: "There is no cleaner counter-offer to respond to." };
  if (j.dispute_lister_counter_used === true) {
    return { ok: false, error: "You have already used your counter-offer for this dispute." };
  }

  const agreed = Math.max(0, Math.round(Number(j.agreed_amount_cents ?? 0)));
  const amountCents = Math.max(0, Math.round(payload.amountCents));
  if (agreed > 0 && amountCents > agreed) {
    return { ok: false, error: "Refund amount cannot exceed the agreed job payment." };
  }
  const note = trimStr(payload.message) || null;

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      proposed_refund_amount: amountCents,
      counter_proposal_amount: null,
      dispute_lister_counter_used: true,
      dispute_status: "disputed",
    } as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) return { ok: false, error: updateError.message };

  let body = `Lister counter-offer: partial refund to lister of $${(amountCents / 100).toFixed(2)} AUD (was responding to cleaner’s $${(prevCounter / 100).toFixed(2)} offer).`;
  if (note) body += `\n\n${note}`;
  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: "lister",
    body,
  });

  if (j.winner_id) {
    await createNotification(
      j.winner_id,
      "dispute_opened",
      jobId,
      `The lister countered with a refund request of $${(amountCents / 100).toFixed(0)}. You can accept or decline on the job page.`
    );
    await sendDisputeActivityEmail({
      jobId,
      toUserId: j.winner_id,
      subject: `[Bond Back] Job #${jobId}: lister counter-offer`,
      htmlBody: `<p>The lister proposed a different partial refund: <strong>$${(amountCents / 100).toFixed(2)}</strong> back to them (responding to your previous offer).</p>${
        note ? `<p style="white-space:pre-wrap;">${escapeHtmlForEmail(note)}</p>` : ""
      }${disputeHubLinksHtml(jobId)}`,
    });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  return { ok: true };
}

export type RejectCounterOfferResult = { ok: true } | { ok: false; error: string };

/** Lister declines the cleaner’s counter-offer; escalates for admin review. */
export async function rejectCounterOfferByLister(jobId: number): Promise<RejectCounterOfferResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, counter_proposal_amount")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    counter_proposal_amount?: number | null;
  };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (session.user.id !== j.lister_id) return { ok: false, error: "Only the lister can decline this offer." };
  if ((j.counter_proposal_amount ?? 0) < 1) return { ok: false, error: "There is no active counter-offer to decline." };

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      status: "in_review",
      counter_proposal_amount: null,
      dispute_status: "in_review",
      dispute_escalated: true,
    } as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) return { ok: false, error: updateError.message };

  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: "lister",
    body: "Declined the cleaner’s counter-offer. Dispute escalated for admin review.",
    isEscalationEvent: true,
  });

  if (j.winner_id) {
    await createNotification(
      j.winner_id,
      "dispute_opened",
      jobId,
      "The lister declined your counter-offer. The dispute has been escalated for admin review."
    );
    await sendDisputeActivityEmail({
      jobId,
      toUserId: j.winner_id,
      subject: `[Bond Back] Job #${jobId}: counter-offer declined`,
      htmlBody: `<p>The lister declined your counter-offer. The dispute has been escalated for admin review.</p>${disputeHubLinksHtml(jobId)}`,
    });
  }

  await notifyAdminUsersAboutJob({
    jobId,
    subject: `[Bond Back] Job #${jobId}: lister declined counter — review`,
    inAppMessage: `Job #${jobId}: lister declined cleaner counter-offer — needs review.`,
    htmlBody: `<p>The lister declined the cleaner’s counter-offer on job #${jobId}. Please review in the admin dispute console.</p>${disputeHubLinksHtml(jobId)}`,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  return { ok: true };
}

export type RequestAdminMediationHelpResult = { ok: true } | { ok: false; error: string };

/** Lister asks Bond Back admins to help mediate (after receiving a cleaner counter-offer). */
export async function requestAdminMediationHelp(jobId: number): Promise<RequestAdminMediationHelpResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, counter_proposal_amount, proposed_refund_amount, admin_mediation_requested"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    counter_proposal_amount?: number | null;
    proposed_refund_amount?: number | null;
    admin_mediation_requested?: boolean | null;
  };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in an active dispute negotiation." };
  }
  if (session.user.id !== j.lister_id) return { ok: false, error: "Only the lister can request admin mediation." };
  if ((j.counter_proposal_amount ?? 0) < 1) {
    return { ok: false, error: "Admin mediation can be requested after you receive a counter-offer from the cleaner." };
  }
  if (j.admin_mediation_requested === true) {
    return { ok: false, error: "Admin mediation has already been requested for this job." };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      admin_mediation_requested: true,
      admin_mediation_requested_at: nowIso,
      dispute_mediation_status: "requested",
      mediation_last_activity_at: nowIso,
    } as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) return { ok: false, error: updateError.message };

  const counter = j.counter_proposal_amount ?? 0;
  const proposed = j.proposed_refund_amount ?? 0;
  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: "lister",
    body: `Requested admin mediation help.\n\nLister asked: $${(proposed / 100).toFixed(2)} refund • Cleaner counter: $${(counter / 100).toFixed(2)}`,
    isEscalationEvent: true,
  });

  await notifyAdminUsersAboutJob({
    jobId,
    subject: `[Bond Back] Job #${jobId}: lister requested mediation`,
    inAppMessage: `Job #${jobId}: the lister requested admin mediation help on a refund counter-offer.`,
    htmlBody: `<p>The lister requested <strong>admin mediation help</strong> on job #${jobId}.</p><p>Lister refund ask: $${(proposed / 100).toFixed(2)} · Cleaner counter: $${(counter / 100).toFixed(2)}</p><p>Review the dispute in the admin console.</p>${disputeHubLinksHtml(jobId)}`,
  });

  if (j.winner_id) {
    await createNotification(
      j.winner_id,
      "dispute_opened",
      jobId,
      "The lister requested admin mediation help on this dispute. Bond Back support has been notified."
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  return { ok: true };
}

export type RejectRefundResult = { ok: true } | { ok: false; error: string };

/**
 * Cleaner rejects the refund proposal → escalate to admin (status in_review).
 */
export async function rejectRefund(jobId: number): Promise<RejectRefundResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, dispute_opened_by")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as { lister_id: string; winner_id: string | null; status: string; dispute_opened_by?: string };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (session.user.id !== j.winner_id) return { ok: false, error: "Only the cleaner can reject the refund proposal." };

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "in_review", counter_proposal_amount: null, dispute_status: "in_review" } as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) return { ok: false, error: updateError.message };

  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: "cleaner",
    body: "Rejected the lister’s partial refund proposal. Dispute escalated for admin review.",
    isEscalationEvent: true,
  });

  if (j.lister_id) {
    await createNotification(j.lister_id, "dispute_opened", jobId, "Cleaner declined the partial refund. The dispute has been escalated for review.");
    await sendDisputeActivityEmail({
      jobId,
      toUserId: j.lister_id,
      subject: `[Bond Back] Job #${jobId}: refund proposal declined`,
      htmlBody: `<p>The cleaner declined your partial refund proposal. The dispute has been escalated for admin review.</p>${disputeHubLinksHtml(jobId)}`,
    });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  return { ok: true };
}

export type AcceptCounterRefundResult = { ok: true } | { ok: false; error: string };

/**
 * Lister accepts the cleaner's counter proposal. Completes job with counter amount as refund.
 */
export async function acceptCounterRefund(jobId: number): Promise<AcceptCounterRefundResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, dispute_opened_by, counter_proposal_amount, listing_id")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as { lister_id: string; winner_id: string | null; status: string; counter_proposal_amount?: number | null; listing_id?: string | number | null };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (session.user.id !== j.lister_id) return { ok: false, error: "Only the lister can accept the counter." };
  const counterCents = j.counter_proposal_amount ?? 0;

  const nowIso = new Date().toISOString();
  const updatePayload = {
    status: "completed",
    dispute_resolution: "counter_accepted_by_lister",
    resolution_type: "release_after_partial_refund",
    resolution_at: nowIso,
    resolution_by: session.user.id,
    dispute_status: "completed",
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) return { ok: false, error: updateError.message };

  const refundResult = await executeRefund(jobId, counterCents);
  if (!refundResult.ok) {
    return { ok: false, error: refundResult.error };
  }

  {
    const postRefund: Partial<JobRow> = { counter_proposal_amount: null };
    if (counterCents >= 1) {
      postRefund.refund_amount = counterCents;
    }
    const { error: refundPersistErr } = await supabase
      .from("jobs")
      .update(postRefund as never)
      .eq("id", jobId);
    if (refundPersistErr) {
      console.error("[acceptCounterRefund] persist refund_amount", refundPersistErr);
    }
  }

  if (j.listing_id) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", j.listing_id);
  }

  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: "lister",
    body: `Accepted cleaner’s counter-offer: $${(counterCents / 100).toFixed(2)} AUD refund to lister. Job completed.`,
  });

  if (j.winner_id) {
    await createNotification(j.winner_id, "payment_released", jobId, `Lister accepted your counter ($${(counterCents / 100).toFixed(0)} refund). Job completed.`);
    await sendDisputeActivityEmail({
      jobId,
      toUserId: j.winner_id,
      subject: `[Bond Back] Job #${jobId}: counter-offer accepted`,
      htmlBody: `<p>The lister accepted your counter-offer. Refund of <strong>$${(counterCents / 100).toFixed(2)}</strong> to the lister is being processed; your payout follows per escrow rules.</p>${disputeHubLinksHtml(jobId)}`,
    });
  }
  if (counterCents >= 1 && j.lister_id) {
    let jobTitle: string | null = null;
    if (j.listing_id) {
      const { data: listing } = await supabase
        .from("listings")
        .select("title")
        .eq("id", j.listing_id)
        .maybeSingle();
      jobTitle = (listing as { title?: string } | null)?.title ?? null;
    }
    await sendRefundReceiptEmail({
      jobId,
      listerId: j.lister_id,
      refundCents: counterCents,
      jobTitle,
      dateIso: nowIso,
    });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  return { ok: true };
}

export type RespondToDisputePayload = {
  reason: string;
  reasonOther?: string;
  photoUrls: string[];
  message?: string;
};

export type RespondToDisputeResult = { ok: true } | { ok: false; error: string };

/**
 * Respond to a dispute (cleaner or lister – the party who did not open it).
 * Stores counter-reason, evidence photos, and message.
 */
export async function respondToDispute(
  jobId: number,
  payload: RespondToDisputePayload
): Promise<RespondToDisputeResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, dispute_opened_by")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const j = job as { lister_id: string; winner_id: string | null; status: string; dispute_opened_by?: string };
  if (j.status !== "disputed" && j.status !== "in_review") {
    return { ok: false, error: "This job is not in dispute." };
  }

  const openedByLister = disputeOpenedByLister(j);
  const isLister = session.user.id === j.lister_id;
  const isCleaner = session.user.id === j.winner_id;
  if (openedByLister && !isCleaner) {
    return { ok: false, error: "Only the cleaner can respond to this dispute." };
  }
  if (!openedByLister && !isLister) {
    return { ok: false, error: "Only the lister can respond to this dispute." };
  }

  const photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls.slice(0, 5) : [];
  const reasonText =
    payload.reason === "other" && trimStr(payload.reasonOther)
      ? `Other: ${trimStr(payload.reasonOther)}`
      : payload.reason;
  const fullReason =
    trimStr(payload.message) ? `${reasonText}\n\n${trimStr(payload.message)}` : reasonText;

  const nowIso = new Date().toISOString();
  const updatePayload = {
    dispute_response_reason: fullReason,
    dispute_response_evidence: photoUrls,
    dispute_response_message: trimStr(payload.message) || null,
    dispute_response_at: nowIso,
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const responderRole = isCleaner ? "cleaner" : "lister";
  await insertDisputeThreadEntry({
    jobId,
    authorUserId: session.user.id,
    authorRole: responderRole,
    body: `Dispute response (${responderRole})\n\n${fullReason}`,
    attachmentUrls: photoUrls,
  });

  const otherUserId = isCleaner ? j.lister_id : j.winner_id;
  if (otherUserId) {
    const reasonSnippet = fullReason.length > 150 ? `${fullReason.slice(0, 147)}…` : fullReason;
    await createNotification(
      otherUserId,
      "dispute_opened",
      jobId,
      `The other party has responded to the dispute. Response: ${reasonSnippet}`
    );
    await sendDisputeActivityEmail({
      jobId,
      toUserId: otherUserId,
      subject: `[Bond Back] Dispute response — job #${jobId}`,
      htmlBody: `<p>The other party responded to the dispute on <strong>job #${jobId}</strong>.</p><p style="white-space:pre-wrap;">${escapeHtmlForEmail(fullReason)}</p>${disputeHubLinksHtml(jobId)}`,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");

  return { ok: true };
}

export type AcceptResolutionResult = { ok: true } | { ok: false; error: string };

/**
 * Mutual "Accept Resolution" — both parties agree to end the dispute and return to lister review.
 * Sets status to `completed_pending_approval` with a fresh auto-release timer; does not release funds.
 */
export async function acceptResolution(jobId: number): Promise<AcceptResolutionResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, listing_id, payment_released_at, payment_intent_id")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const j = job as { lister_id: string; winner_id: string | null; status: string; listing_id?: string | number | null; payment_released_at?: string | null; payment_intent_id?: string | null };
  if (j.status !== "disputed" && j.status !== "in_review") {
    return { ok: false, error: "This job is not in dispute." };
  }

  const isParty = session.user.id === j.lister_id || session.user.id === j.winner_id;
  if (!isParty) {
    return { ok: false, error: "You are not part of this job." };
  }

  const nowIso = new Date().toISOString();
  const settings = await getGlobalSettings();
  const hrs = settings?.auto_release_hours ?? 48;
  const newReleaseIso = new Date(
    Date.now() + hrs * 60 * 60 * 1000
  ).toISOString();

  /** Mutual agreement: close dispute and return to lister review — no payout until lister approves again. */
  const updatePayload = {
    status: "completed_pending_approval",
    dispute_resolution: "mutual_agreement",
    resolution_type: "return_to_review",
    resolution_at: nowIso,
    resolution_by: session.user.id,
    dispute_status: "resolved",
    auto_release_at: newReleaseIso,
    auto_release_at_original: newReleaseIso,
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const resolvedMsg =
    "Dispute closed by mutual agreement. The lister has a fresh review window — funds stay in escrow until they approve or the timer elapses.";
  if (j.winner_id) {
    await createNotification(j.winner_id, "dispute_resolved", jobId, resolvedMsg);
  }
  await createNotification(j.lister_id, "dispute_resolved", jobId, resolvedMsg);

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");

  return { ok: true };
}
