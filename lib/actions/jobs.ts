"use server";

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
import { getStripeServer, createJobCheckoutSessionUrl, createJobPaymentIntentWithSavedMethod } from "@/lib/stripe";
import { isStripeTestMode } from "@/lib/stripe/config";
import { ensureConnectAccountCanReceiveTransfers } from "@/lib/actions/stripe-connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";
import { applyReferralRewardsForCompletedJob } from "@/lib/actions/referral-rewards";
import { logTimerActivity } from "@/lib/admin-activity-log";
import { getCleanerReadyToRequestPaymentByJobId } from "@/lib/jobs/cleaner-complete-readiness";
import { formatListingAddonDisplayName } from "@/lib/listing-addon-prices";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

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

  if (j.payment_intent_id?.trim()) {
    return { ok: true, paymentIntentId: j.payment_intent_id };
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
 * Used after the cleaner confirms an early acceptance (see `lib/actions/early-bid-acceptance.ts`).
 * Listing is closed, other bids cancelled. Requires service role for token-based confirm flows.
 */
export async function finalizeBidAcceptanceCore(params: {
  listingId: string;
  listerId: string;
  cleanerId: string;
  acceptedAmountCents: number;
  listingTitle: string | null;
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

  if (listRow.lister_id !== params.listerId) {
    return { ok: false, error: "Listing mismatch." };
  }

  if (listRow.status !== "live") {
    return { ok: false, error: "This listing is no longer accepting bids." };
  }

  const settings = await getGlobalSettings();
  if (settings?.require_stripe_connect_before_bidding !== false) {
    const { data: cleanerProfile } = await admin
      .from("profiles")
      .select("stripe_connect_id, stripe_onboarding_complete")
      .eq("id", params.cleanerId)
      .maybeSingle();
    const cp = cleanerProfile as { stripe_connect_id?: string | null; stripe_onboarding_complete?: boolean } | null;
    const stripeConnectId = cp?.stripe_connect_id;
    const onboardingComplete = cp?.stripe_onboarding_complete === true;
    if (!stripeConnectId?.trim() || !onboardingComplete) {
      return {
        ok: false,
        error:
          "You must connect your bank account in Profile before you can accept this job.",
      };
    }
  }

  const { data: existingJob } = await admin
    .from("jobs")
    .select("id")
    .eq("id", listRow.id as never)
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
      id: listRow.id,
      listing_id: listRow.id,
      lister_id: listRow.lister_id,
      winner_id: params.cleanerId,
      status: "accepted",
      agreed_amount_cents: amountCents,
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

  await admin.from("bids").update({ status: "cancelled" } as never).eq("listing_id", params.listingId);

  await admin.from("listings").update({ status: "ended" } as never).eq("id", params.listingId);

  const listingTitle = params.listingTitle ?? listRow.title ?? null;
  await createNotification(
    params.listerId,
    "job_created",
    numericJobId,
    "You accepted a bid. Pay & Start Job to hold funds in escrow and start the job."
  );
  await createNotification(
    params.cleanerId,
    "job_accepted",
    numericJobId,
    "The lister accepted your bid. They'll pay and start the job to hold funds in escrow; then you can begin.",
    { listingTitle }
  );

  revalidateJobsBrowseCaches();
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${params.listingId}`);
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

  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", listRow.id)
    .maybeSingle();

  if (existingJob) {
    return { ok: false, error: "This job is already taken." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("jobs")
    .insert({
      id: listRow.id,
      listing_id: listRow.id,
      lister_id: listRow.lister_id,
      winner_id: session.user.id,
      status: "accepted",
      agreed_amount_cents: listRow.buy_now_cents,
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

  const listingTitle = listRow.title ?? null;
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

  revalidateJobsBrowseCaches();
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");

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

  if (row.payment_intent_id?.trim()) {
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

  const pmId = (listerProfile as { stripe_payment_method_id?: string | null } | null)?.stripe_payment_method_id?.trim();
  const customerId = (listerProfile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id?.trim() ?? null;

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
    const url = await createJobCheckoutSessionUrl(
      { id: numericJobId, agreed_amount_cents: agreedCents },
      { title: (listing as { title?: string }).title ?? "Bond clean", suburb: (listing as { suburb?: string }).suburb ?? "", postcode: (listing as { postcode?: string }).postcode ?? "" },
      feePercent
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

export type FulfillJobPaymentFromSessionResult = { ok: true } | { ok: false; error: string };

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
        .select("addons")
        .eq("id", checkoutJob.listing_id as never)
        .maybeSingle();

      const addons = ((listingForChecklist as { addons?: string[] | null } | null)?.addons ??
        []) as string[];
      const specialAreaKeys = ["balcony", "garage", "laundry", "patio"] as const;
      const isSpecialArea = (key: string) =>
        (specialAreaKeys as readonly string[]).includes(key);
      const defaultLabels = [
        "Vacuum Apartment/House",
        "Clean all Bedrooms",
        "Clean all Bathrooms",
        "Clean Toilet",
        "Clean Kitchen",
        "Clean Laundry",
        "Mop Floors (if needed)",
      ];

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
    .select("addons")
    .eq("id", checklistJob.listing_id as never)
    .maybeSingle();
  const addons = ((listingForChecklist as { addons?: string[] | null } | null)?.addons ??
    []) as string[];
  const specialAreaKeys = ["balcony", "garage", "laundry", "patio"] as const;
  const isSpecialArea = (key: string) =>
    (specialAreaKeys as readonly string[]).includes(key);
  const defaultLabels = [
    "Vacuum Apartment/House",
    "Clean all Bedrooms",
    "Clean all Bathrooms",
    "Clean Toilet",
    "Clean Kitchen",
    "Clean Laundry",
    "Mop Floors (if needed)",
  ];
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

  if (!approveRow.payment_intent_id?.trim()) {
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
      .select("addons")
      .eq("id", approveRow.listing_id as never)
      .maybeSingle();

    const addons = ((listingForChecklist as { addons?: string[] | null } | null)?.addons ??
      []) as string[];

    const specialAreaKeys = ["balcony", "garage", "laundry", "patio"] as const;
    const isSpecialArea = (key: string) =>
      (specialAreaKeys as readonly string[]).includes(key);

    const defaultLabels = [
      "Vacuum Apartment/House",
      "Clean all Bedrooms",
      "Clean all Bathrooms",
      "Clean Toilet",
      "Clean Kitchen",
      "Clean Laundry",
      "Mop Floors (if needed)",
    ];

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

  if (cancelRow.payment_intent_id?.trim()) {
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
  const raw = String(jobId).trim();
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
      "id, listing_id, payment_intent_id, agreed_amount_cents, winner_id, payment_released_at, stripe_transfer_id"
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
  };

  if (j.payment_released_at) {
    return { ok: true };
  }

  if (!j.payment_intent_id?.trim()) {
    return { ok: false, error: "Job has no payment hold (payment_intent_id)." };
  }

  const agreedCents = j.agreed_amount_cents ?? 0;
  if (agreedCents < 1) {
    return { ok: false, error: "Job has no agreed amount." };
  }

  if (!j.winner_id?.trim()) {
    return { ok: false, error: "Job has no cleaner (winner_id)." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_id")
    .eq("id", j.winner_id)
    .maybeSingle();

  const stripeConnectId = (profile as { stripe_connect_id?: string | null } | null)?.stripe_connect_id;
  if (!stripeConnectId?.trim()) {
    return { ok: false, error: "Cleaner has not connected a bank account (Stripe Connect)." };
  }

  let stripe;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(j.payment_intent_id);
    if (pi.status === "requires_action") {
      return {
        ok: false,
        error: "This payment requires authentication (e.g. 3D Secure). Please complete verification from your payment method or use a different card, then try again.",
      };
    }
    if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
      return {
        ok: false,
        error: `Payment cannot be released yet (status: ${pi.status}). Please ensure the payment was completed successfully.`,
      };
    }

    let chargeId: string | undefined;
    if (pi.status === "requires_capture") {
      const captured = await stripe.paymentIntents.capture(j.payment_intent_id);
      chargeId =
        typeof captured.latest_charge === "string"
          ? captured.latest_charge
          : (captured.latest_charge as { id?: string } | null)?.id;
    } else if (pi.status === "succeeded" && j.stripe_transfer_id?.trim()) {
      // Already captured and transfer created previously; ensure DB is in sync
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ payment_released_at: nowIso, updated_at: nowIso } as never)
        .eq("id", numericJobId);
      if (updateError) return { ok: false, error: updateError.message };
      return { ok: true };
    } else if (pi.status === "succeeded") {
      chargeId =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : (pi.latest_charge as { id?: string } | null)?.id;
    }

    // Transfer cleaner's net share from the platform escrow balance.
    // Fee is computed from the job price (agreed_amount_cents), and the payment hold totals:
    // total = job + fee; net = total - fee.
    const settings = await getGlobalSettings();
    const feePercent = await fetchPlatformFeePercentForListing(
      supabase,
      j.listing_id,
      settings
    );
    const feeCents = Math.round((agreedCents * feePercent) / 100);
    const totalCents = agreedCents + feeCents;
    const netCents = Math.max(1, totalCents - feeCents);

    const transferParams: {
      amount: number;
      currency: string;
      destination: string;
      metadata: { job_id: string };
      source_transaction?: string;
    } = {
      amount: netCents,
      currency: "aud",
      destination: stripeConnectId,
      metadata: { job_id: String(numericJobId) },
    };
    if (chargeId) transferParams.source_transaction = chargeId;

    const connectReady = await ensureConnectAccountCanReceiveTransfers(
      stripe,
      stripeConnectId
    );
    if (!connectReady.ok) {
      return { ok: false, error: connectReady.error };
    }

    const transfer = await stripe.transfers.create(transferParams);

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        payment_released_at: nowIso,
        stripe_transfer_id: transfer.id,
        updated_at: nowIso,
      } as never)
      .eq("id", numericJobId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    const testMode = await isStripeTestMode();
    if (testMode) {
      console.log("[Stripe Test] PaymentIntent captured:", j.payment_intent_id, "Transfer created:", transfer.id);
    }
    return {
      ok: true,
      ...(testMode ? { transferId: transfer.id, paymentIntentId: j.payment_intent_id } : {}),
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

  if (!j.payment_intent_id?.trim()) {
    return { ok: false, error: "Job has no payment hold; cannot process Stripe refund." };
  }

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
    const pi = await stripe.paymentIntents.retrieve(j.payment_intent_id);
    if (pi.status === "requires_capture") {
      await stripe.paymentIntents.capture(j.payment_intent_id);
    }

    await stripe.refunds.create({
      payment_intent: j.payment_intent_id,
      amount,
      reason: "requested_by_customer",
      metadata: { job_id: String(jobId) },
    });

    if (j.stripe_transfer_id?.trim() && amount > feeCents && agreedCents >= 1) {
      const reverseCents = Math.min(agreedCents, amount - feeCents);
      if (reverseCents >= 1) {
        await stripe.transfers.createReversal(j.stripe_transfer_id, {
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
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

  if (row.lister_id !== session.user.id) {
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

  // New flow: ready for release when checklist is complete and 3+ after-photos are uploaded
  // (no separate "mark complete" action; cleaner completing checklist + photos is enough)
  const { data: items, error: checklistError } = await supabase
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
  const { data: afterFiles, error: afterError } = await supabase.storage
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
    .select("id, lister_id, winner_id, status, cleaner_confirmed_complete")
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
    payload.reason === "other" && payload.reasonOther?.trim()
      ? `Other: ${payload.reasonOther.trim()}`
      : payload.reason;
  const fullReason =
    payload.message?.trim() ? `${reasonText}\n\nAdditional details: ${payload.message.trim()}` : reasonText;

  const nowIso = new Date().toISOString();
  const updatePayload = {
    status: "disputed",
    dispute_reason: fullReason,
    dispute_photos: photoUrls, // legacy
    dispute_evidence: photoUrls,
    dispute_opened_by: isLister ? "lister" : "cleaner",
    disputed_at: nowIso,
    dispute_status: "disputed",
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

  const otherUserId = isLister ? j.winner_id : j.lister_id;
  const reasonSnippet = fullReason.length > 150 ? `${fullReason.slice(0, 147)}…` : fullReason;
  if (otherUserId) {
    const msg =
      `A dispute has been opened on this job. Auto-release is paused. You have 72 hours to respond. Reason: ${reasonSnippet}`;
    await createNotification(otherUserId, "dispute_opened", jobId, msg);
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
  if (!row.auto_release_at?.trim()) {
    return {
      ok: false,
      error: "No active review timer is set (cannot extend when auto-release is paused).",
    };
  }

  const prev = new Date(row.auto_release_at).getTime();
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
  const j = job as { lister_id: string; winner_id: string | null; status: string; dispute_opened_by?: string; proposed_refund_amount?: number | null };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (j.dispute_opened_by !== "lister") return { ok: false, error: "Only the lister can propose a refund; this flow is for the cleaner to accept." };
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

  const listingIdForJob =
    (job as { listing_id?: string | number | null }).listing_id ?? null;
  if (listingIdForJob) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", listingIdForJob as never);
  }

  if (j.lister_id) {
    await createNotification(j.lister_id, "payment_released", jobId, `Cleaner accepted partial refund of $${(refundCents / 100).toFixed(0)}. Job completed.`);
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
    .select("id, lister_id, winner_id, status, dispute_opened_by, proposed_refund_amount")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };
  const j = job as { lister_id: string; winner_id: string | null; status: string; dispute_opened_by?: string; proposed_refund_amount?: number | null };
  if (j.status !== "dispute_negotiating" && j.status !== "disputed") {
    return { ok: false, error: "This job is not in refund negotiation." };
  }
  if (session.user.id !== j.winner_id) return { ok: false, error: "Only the cleaner can counter." };

  const amountCents = Math.max(0, Math.round(payload.amountCents));
  const responseMessage = payload.message?.trim() || null;
  const responsePhotos =
    Array.isArray(payload.photoUrls) && payload.photoUrls.length > 0
      ? payload.photoUrls.slice(0, 5)
      : undefined;

  const updatePayload: Record<string, unknown> = {
    counter_proposal_amount: amountCents,
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

  if (j.lister_id) {
    await createNotification(
      j.lister_id,
      "dispute_opened",
      jobId,
      `Cleaner countered with partial refund of $${(amountCents / 100).toFixed(0)}. You can accept or respond on the job page.`
    );
  }
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
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

  if (j.lister_id) {
    await createNotification(j.lister_id, "dispute_opened", jobId, "Cleaner declined the partial refund. The dispute has been escalated for review.");
  }
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
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

  if (j.listing_id) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", j.listing_id);
  }

  if (j.winner_id) {
    await createNotification(j.winner_id, "payment_released", jobId, `Lister accepted your counter ($${(counterCents / 100).toFixed(0)} refund). Job completed.`);
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

  const openedByLister = j.dispute_opened_by === "lister";
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
    payload.reason === "other" && payload.reasonOther?.trim()
      ? `Other: ${payload.reasonOther.trim()}`
      : payload.reason;
  const fullReason =
    payload.message?.trim() ? `${reasonText}\n\n${payload.message.trim()}` : reasonText;

  const nowIso = new Date().toISOString();
  const updatePayload = {
    dispute_response_reason: fullReason,
    dispute_response_evidence: photoUrls,
    dispute_response_message: payload.message?.trim() || null,
    dispute_response_at: nowIso,
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const otherUserId = isCleaner ? j.lister_id : j.winner_id;
  if (otherUserId) {
    const reasonSnippet = fullReason.length > 150 ? `${fullReason.slice(0, 147)}…` : fullReason;
    await createNotification(
      otherUserId,
      "dispute_opened",
      jobId,
      `The other party has responded to the dispute. Response: ${reasonSnippet}`
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");

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
