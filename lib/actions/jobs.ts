"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { createNotification, sendPaymentReceiptEmails, sendRefundReceiptEmail } from "@/lib/actions/notifications";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getStripeServer, createJobCheckoutSessionUrl, createJobPaymentIntentWithSavedMethod } from "@/lib/stripe";
import { isStripeTestMode } from "@/lib/stripe/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";
import { applyReferralRewardsForCompletedJob } from "@/lib/actions/referral-rewards";

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
  const feePercent =
    settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12;
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
 * Lister accepts a bid: create job with winner_id = cleanerId and agreed_amount_cents, then create payment hold.
 * When "Require Stripe Connect before bidding" is on, the cleaner must have stripe_connect_id.
 */
export async function acceptBid(
  listingId: string,
  cleanerId: string,
  acceptedAmountCents: number
): Promise<AcceptBidResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, lister_id, status, title")
    .eq("id", listingId)
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

  if (listRow.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can accept a bid." };
  }

  if (listRow.status !== "live") {
    return { ok: false, error: "This listing is no longer accepting bids." };
  }

  const settings = await getGlobalSettings();
  if (settings?.require_stripe_connect_before_bidding !== false) {
    const { data: cleanerProfile } = await supabase
      .from("profiles")
      .select("stripe_connect_id, stripe_onboarding_complete")
      .eq("id", cleanerId)
      .maybeSingle();
    const cp = cleanerProfile as { stripe_connect_id?: string | null; stripe_onboarding_complete?: boolean } | null;
    const stripeConnectId = cp?.stripe_connect_id;
    const onboardingComplete = cp?.stripe_onboarding_complete === true;
    if (!stripeConnectId?.trim() || !onboardingComplete) {
      return {
        ok: false,
        error: "This cleaner has not connected their bank account yet. They need to connect in Profile before you can accept their bid.",
      };
    }
  }

  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", listRow.id)
    .maybeSingle();

  if (existingJob) {
    return { ok: false, error: "A job already exists for this listing." };
  }

  const amountCents = Math.max(0, Math.round(Number(acceptedAmountCents)));
  if (amountCents < 1) {
    return { ok: false, error: "Invalid bid amount." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("jobs")
    .insert({
      id: listRow.id,
      listing_id: listRow.id,
      lister_id: listRow.lister_id,
      winner_id: cleanerId,
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

  const listingTitle = listRow.title ?? null;
  await createNotification(
    listRow.lister_id,
    "job_created",
    numericJobId,
    "You accepted a bid. Pay & Start Job to hold funds in escrow and start the job."
  );
  await createNotification(
    cleanerId,
    "job_accepted",
    numericJobId,
    "The lister accepted your bid. They'll pay and start the job to hold funds in escrow; then you can begin.",
    { listingTitle }
  );

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/dashboard");

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

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/dashboard");
  revalidatePath("/messages");

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

  if (job.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can pay and start this job." };
  }

  if (job.status !== "accepted") {
    return { ok: false, error: "Job must be in 'accepted' status to pay and start." };
  }

  const j = job as { payment_intent_id?: string | null; agreed_amount_cents?: number | null };
  if (j.payment_intent_id?.trim()) {
    return { ok: false, error: "Payment is already held in escrow for this job." };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, suburb, postcode, buy_now_cents, reserve_cents")
    .eq("id", job.listing_id)
    .maybeSingle();

  if (!listing) {
    return { ok: false, error: "Listing not found." };
  }

  // Use job's agreed amount, or fall back to listing price so Pay & Start Job still works
  let agreedCents = j.agreed_amount_cents ?? 0;
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
  const feePercent =
    settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data: listerProfile } = await supabase
    .from("profiles")
    .select("stripe_payment_method_id, stripe_customer_id")
    .eq("id", job.lister_id)
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
      baseUrl,
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
      : (cs.payment_intent as import("stripe").PaymentIntent | null);

  if (!pi?.id) {
    return { ok: false, error: "No PaymentIntent on session." };
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, listing_id")
    .eq("id", numericJobId)
    .maybeSingle();

  if (!job || job.lister_id !== session.user.id) {
    return { ok: false, error: "Job not found or you are not the lister." };
  }
  if (job.status !== "accepted") {
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

  if ((job as { winner_id?: string | null }).winner_id) {
    await createNotification(
      (job as { winner_id: string }).winner_id,
      "job_approved_to_start",
      numericJobId,
      "Lister approved – you can start the job."
    );
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
      .eq("id", job.listing_id as never)
      .maybeSingle();

    const addons = (listingForChecklist?.addons ?? []) as string[];
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
      const pretty = addon.replace(/_/g, " ");
      const label = isSpecialArea(addon)
        ? `Special area: ${pretty.charAt(0).toUpperCase() + pretty.slice(1)}`
        : `Add-on: ${pretty}`;
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

  if (!job || job.status !== "in_progress") return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  if (userId !== job.lister_id && userId !== job.winner_id) return;

  const { data: existing } = await supabase
    .from("job_checklist_items")
    .select("id")
    .eq("job_id", numericJobId as never)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: listingForChecklist } = await supabase
    .from("listings")
    .select("addons")
    .eq("id", job.listing_id as never)
    .maybeSingle();
  const addons = (listingForChecklist?.addons ?? []) as string[];
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
    const pretty = addon.replace(/_/g, " ");
    const label = isSpecialArea(addon)
      ? `Special area: ${pretty.charAt(0).toUpperCase() + pretty.slice(1)}`
      : `Add-on: ${pretty}`;
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

  if (job.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can approve the job start." };
  }

  if (job.status !== "accepted") {
    return {
      ok: false,
      error: "Job must be in 'accepted' status to approve start.",
    };
  }

  const j = job as { payment_intent_id?: string | null };
  if (!j.payment_intent_id?.trim()) {
    return {
      ok: false,
      error: "Pay and start the job first (Pay & Start Job) so funds are in escrow.",
    };
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "in_progress", updated_at: new Date().toISOString() } as Partial<JobRow> as never)
    .eq("id", job.id as never);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const numericJobId =
    typeof job.id === "number" ? job.id : Number(job.id);

  const { data: existingItems } = await supabase
    .from("job_checklist_items")
    .select("id")
    .eq("job_id", numericJobId as never)
    .limit(1);

  if (!existingItems || existingItems.length === 0) {
    const { data: listingForChecklist } = await supabase
      .from("listings")
      .select("addons")
      .eq("id", job.listing_id as never)
      .maybeSingle();

    const addons = (listingForChecklist?.addons ?? []) as string[];

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
      const pretty = addon.replace(/_/g, " ");
      const label = isSpecialArea(addon)
        ? `Special area: ${pretty.charAt(0).toUpperCase() + pretty.slice(1)}`
        : `Add-on: ${pretty}`;
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

  if (job.winner_id) {
    await createNotification(
      job.winner_id,
      "job_accepted",
      typeof job.id === "number" ? job.id : Number(job.id),
      "Job has started. You can begin work."
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${job.id}`);

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

  if (job.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can cancel this job." };
  }

  if (job.status !== "accepted") {
    return { ok: false, error: "Job can only be cancelled while it is pending your payment (accepted, before Pay & Start Job)." };
  }

  const j = job as { payment_intent_id?: string | null };
  if (j.payment_intent_id?.trim()) {
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

  if (job.winner_id) {
    await createNotification(
      job.winner_id,
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

  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, auto_release_at, auto_release_at_original"
    )
    .or(
      `id.eq.${jobId.toString()},listing_id.eq.${jobId.toString()}`
    )
    .maybeSingle();

  if (error || !job) {
    console.error("DEBUG: markJobChecklistFinished job lookup failed", {
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

  if (job.winner_id !== session.user.id) {
    return { ok: false, error: "Only the cleaner can mark tasks finished." };
  }

  const isAlreadyCompletedPending =
    job.status === "completed_pending_approval" &&
    job.cleaner_confirmed_complete &&
    job.cleaner_confirmed_at;

  if (job.status !== "in_progress" && !isAlreadyCompletedPending) {
    return {
      ok: false,
      error: "Job must be in progress to finish the checklist.",
    };
  }

  const nowIso = new Date().toISOString();
  const settings = await getGlobalSettings();
  const autoReleaseHours = settings?.auto_release_hours ?? 48;

  // If the cleaner already confirmed completion earlier, keep the same baseline
  // using `cleaner_confirmed_at` rather than "now".
  const baselineIso = job.cleaner_confirmed_at ?? nowIso;
  const baselineMs = new Date(baselineIso).getTime();
  const autoReleaseAtIso = new Date(
    baselineMs + autoReleaseHours * 60 * 60 * 1000
  ).toISOString();

  if (
    isAlreadyCompletedPending &&
    job.auto_release_at &&
    job.auto_release_at_original
  ) {
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update(
      {
        cleaner_confirmed_complete: true,
        cleaner_confirmed_at: job.cleaner_confirmed_at ?? nowIso,
        status: "completed_pending_approval",
        auto_release_at: autoReleaseAtIso,
        auto_release_at_original: autoReleaseAtIso,
        completed_at: nowIso,
      } as Partial<JobRow> as never
    )
    .eq("id", job.id as never);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (job.lister_id) {
    await createNotification(
      job.lister_id,
      "job_completed",
      typeof job.id === "number" ? job.id : Number(job.id),
      "Job complete – review photos and approve within 48 hours or funds auto-release."
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${job.id}`);

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
  const supabase =
    options?.supabase ?? (await createServerSupabaseClient());
  const numericJobId = typeof jobId === "number" ? jobId : Number(jobId);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, payment_intent_id, agreed_amount_cents, winner_id, payment_released_at, stripe_transfer_id")
    .eq("id", numericJobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const j = job as {
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
    const feePercent =
      settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12;
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
    const message =
      err.raw?.message ?? err.message ?? "Failed to capture or transfer.";
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
    .select("id, payment_intent_id, agreed_amount_cents, stripe_transfer_id, payment_released_at")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) return { ok: false, error: "Job not found." };
  const j = job as {
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
  const feePct = (settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 0) / 100;
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

  if (job.lister_id !== session.user.id) {
    return { ok: false, error: "Only the lister can finalize payment." };
  }

  if (
    job.status !== "in_progress" &&
    job.status !== "completed_pending_approval"
  ) {
    return {
      ok: false,
      error: "Job must be pending approval/in progress to finalize payment.",
    };
  }

  const numericJobId =
    typeof job.id === "number" ? job.id : Number(job.id);

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

  const jobRow = job as { cleaner_confirmed_complete?: boolean; cleaner_confirmed_at?: string | null };
  const updatePayload: Partial<JobRow> & { status: string } = { status: "completed" };
  if (!jobRow.cleaner_confirmed_complete) {
    (updatePayload as Record<string, unknown>).cleaner_confirmed_complete = true;
    (updatePayload as Record<string, unknown>).cleaner_confirmed_at = new Date().toISOString();
  }
  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", job.id as never);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (job.listing_id) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", job.listing_id as never);
  }

  if (job.winner_id) {
    const agreedCentsForSms = (job as { agreed_amount_cents?: number | null }).agreed_amount_cents ?? 0;
    await createNotification(
      job.winner_id,
      "payment_released",
      numericJobId,
      "Payment has been released. Funds are on the way to your connected bank account.",
      { amountCents: agreedCentsForSms }
    );
  }

  const agreedCents = (job as { agreed_amount_cents?: number | null }).agreed_amount_cents ?? 0;
  if (agreedCents >= 1 && job.lister_id) {
    const settings = await getGlobalSettings();
    const feePct =
      (settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12) / 100;
    const feeCents = Math.round(agreedCents * feePct);
    const totalCents = agreedCents + feeCents;
    let jobTitle: string | null = null;
    if (job.listing_id) {
      const { data: listing } = await supabase
        .from("listings")
        .select("title")
        .eq("id", job.listing_id)
        .maybeSingle();
      jobTitle = (listing as { title?: string } | null)?.title ?? null;
    }
    await sendPaymentReceiptEmails({
      jobId: numericJobId,
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

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);

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

  // Jobs move into `completed_pending_approval` when the cleaner finishes the checklist.
  // Cron runs with no user session — use service role so RLS does not block reads/updates.
  // Admin override updates `auto_release_at`, so we rely on that timestamp when present.
  const { data: jobs, error } = await admin
    .from("jobs")
    .select(
      "id, listing_id, lister_id, winner_id, agreed_amount_cents, auto_release_at, auto_release_at_original, cleaner_confirmed_at"
    )
    .in("status", ["completed_pending_approval", "in_progress"])
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
    if (atIso) return new Date(atIso).getTime();
    if (job.cleaner_confirmed_at) {
      return (
        new Date(job.cleaner_confirmed_at).getTime() +
        autoReleaseHours * 60 * 60 * 1000
      );
    }
    return null;
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

    const notificationRows: {
      user_id: string;
      type: string;
      job_id: number;
      message_text: string;
    }[] = [];
    if (job.winner_id) {
      notificationRows.push({
        user_id: job.winner_id,
        type: "payment_released",
        job_id: job.id,
        message_text:
          "Funds auto-released (review window elapsed). Payment is on the way to your connected account.",
      });
    }
    if (job.lister_id) {
      notificationRows.push({
        user_id: job.lister_id,
        type: "payment_released",
        job_id: job.id,
        message_text:
          "Funds were automatically released from escrow (review window elapsed).",
      });
    }
    if (notificationRows.length) {
      await admin.from("notifications").insert(notificationRows as never);
    }

    const agreedCents = job.agreed_amount_cents ?? 0;
    if (agreedCents >= 1 && job.lister_id) {
      const feePct =
        (settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12) /
        100;
      const feeCents = Math.round(agreedCents * feePct);
      const totalCents = agreedCents + feeCents;
      let jobTitle: string | null = null;
      if (job.listing_id) {
        const { data: listing } = await admin
          .from("listings")
          .select("title")
          .eq("id", job.listing_id)
          .maybeSingle();
        jobTitle = (listing as { title?: string } | null)?.title ?? null;
      }
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
  if (otherUserId) {
    const reasonSnippet = fullReason.length > 150 ? `${fullReason.slice(0, 147)}…` : fullReason;
    const msg =
      `A dispute has been opened on this job. You have 72 hours to respond. Reason: ${reasonSnippet}`;
    await createNotification(otherUserId, "dispute_opened", jobId, msg);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/my-listings");
  revalidatePath("/admin/disputes");

  return { ok: true };
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
 * Mutual "Accept Resolution" – both parties agree (e.g. partial refund).
 * Sets dispute_resolution and completes the job.
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

  // Mutual agreement closes the dispute and releases funds to the cleaner.
  if (!j.payment_released_at && j.payment_intent_id?.trim()) {
    const releaseResult = await releaseJobFunds(jobId);
    if (!releaseResult.ok) {
      return { ok: false, error: releaseResult.error };
    }
  }

  const updatePayload = {
    status: "completed",
    dispute_resolution: "mutual_agreement",
    resolution_type: "release_funds",
    resolution_at: nowIso,
    resolution_by: session.user.id,
    dispute_status: "completed",
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as Partial<JobRow> as never)
    .eq("id", jobId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Dispute resolved by mutual agreement and funds released; mark listing ended
  // so it no longer shows as live.
  if (j.listing_id) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", j.listing_id as never);
  }

  const resolvedMsg = "Dispute resolved by mutual agreement. Funds have been released.";
  if (j.winner_id) {
    await createNotification(j.winner_id, "payment_released", jobId, resolvedMsg);
    await createNotification(j.winner_id, "dispute_resolved", jobId, resolvedMsg);
  }
  await createNotification(j.lister_id, "payment_released", jobId, resolvedMsg);
  await createNotification(j.lister_id, "dispute_resolved", jobId, resolvedMsg);

  await applyReferralRewardsForCompletedJob(jobId);

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");

  return { ok: true };
}

export type NotifyFundsReadyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function notifyFundsReady(
  jobId: string | number
): Promise<NotifyFundsReadyResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at")
    .eq("id", jobId as never)
    .maybeSingle();

  if (error || !job) {
    return { ok: false, error: "Job not found." };
  }

  if (!job.lister_id) {
    return { ok: false, error: "Job has no lister." };
  }

  const jobRow = job as { winner_id?: string | null; status?: string; cleaner_confirmed_complete?: boolean; cleaner_confirmed_at?: string | null };
  if (jobRow.winner_id !== session.user.id) {
    return { ok: false, error: "Only the cleaner can notify that funds are ready." };
  }
  if (jobRow.status !== "in_progress") {
    return { ok: false, error: "Job is not in progress." };
  }

  const numericJobId =
    typeof job.id === "number" ? job.id : Number(job.id);

  // New flow: auto "mark complete" when checklist + 3 after-photos are done
  if (!jobRow.cleaner_confirmed_complete || !jobRow.cleaner_confirmed_at) {
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
      return { ok: false, error: "Complete all checklist tasks first." };
    }
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
      return { ok: false, error: "Upload at least 3 after-photos first." };
    }
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("jobs")
      .update(
        { cleaner_confirmed_complete: true, cleaner_confirmed_at: nowIso } as Partial<JobRow> as never
      )
      .eq("id", job.id as never);
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
    if (job.lister_id) {
      await createNotification(
        job.lister_id,
        "job_completed",
        numericJobId,
        "Cleaner marked Job #" + String(job.id) + " complete – review photos and approve & release funds."
      );
    }
  }

  await createNotification(
    job.lister_id,
    "funds_ready",
    numericJobId,
    "Your cleaner has finished the checklist and uploaded after-photos. Review everything and release funds when you’re ready."
  );

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${job.id}`);

  return { ok: true };
}

