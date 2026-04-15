import Stripe from "stripe";
import { getStripeCheckoutAppUrl } from "@/lib/site";
import { getStripeConfig, getStripeConfigForMode, type StripeMode } from "@/lib/stripe/config";

/** Platform fee: 12% of transaction (e.g. cleaner payout = 88%). */
export const PLATFORM_FEE_PERCENT = 12;

let stripeServer: Stripe | null = null;
const stripeServerByMode: { test: Stripe | null; live: Stripe | null } = { test: null, live: null };

/** Call after saving global_settings (e.g. toggling Stripe test mode) so the next request uses the new keys. */
export function clearStripeServerCache(): void {
  stripeServer = null;
}

/**
 * Server-side Stripe client. Uses global_settings.stripe_test_mode to choose test vs live keys.
 * Use only in API routes, server actions, or backend.
 */
export async function getStripeServer(): Promise<Stripe> {
  if (stripeServer) return stripeServer;

  const { secretKey } = await getStripeConfig();
  stripeServer = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });

  return stripeServer;
}

/**
 * Server-side Stripe client for a specific mode (env keys only, no global_settings).
 * Use in webhook handler so API calls match the event's livemode.
 */
export function getStripeServerForMode(mode: StripeMode): Stripe {
  const existing = stripeServerByMode[mode];
  if (existing) return existing;

  const { secretKey } = getStripeConfigForMode(mode);
  const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
  stripeServerByMode[mode] = stripe;
  return stripe;
}

/**
 * Create Stripe Checkout Session for a listing's buy-now price.
 * Caller must have validated listing has buy_now_cents and is live.
 * Platform fee (12%): use payment_intent_data.application_fee_amount when on Connect.
 */
export async function createBuyNowCheckoutSessionUrl(
  listing: { id: string; title: string; suburb: string; postcode: string; buy_now_cents: number; lister_id: string }
): Promise<string | null> {
  const baseUrl = getStripeCheckoutAppUrl();
  const stripe = await getStripeServer();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: listing.buy_now_cents,
          product_data: {
            name: listing.title,
            description: `Bond clean buy-now: ${listing.suburb} ${listing.postcode}`,
          },
        },
      },
    ],
    success_url: `${baseUrl}/listings/${listing.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/listings/${listing.id}?payment=canceled`,
    client_reference_id: listing.id,
    metadata: {
      listing_id: listing.id,
      lister_id: listing.lister_id,
      type: "buy_now",
    },
    // Platform fee 12%: when using Stripe Connect, set
    // payment_intent_data.application_fee_amount = listing.buy_now_cents * PLATFORM_FEE_PERCENT / 100
  });
  return session.url ?? null;
}

/**
 * Create Stripe Checkout Session for a job so the lister can pay and start the job (funds held in escrow).
 *
 * Calculation: total = agreed_amount (to cleaner) + platform fee.
 * Example: $395 job + 12% fee = $395 + $47.40 = $442.40 charged at checkout.
 * Fee % is passed by the caller (from the listing row snapshot at creation, not only global settings).
 */
export async function createJobCheckoutSessionUrl(
  job: { id: number | string; agreed_amount_cents: number },
  listing: { title: string; suburb: string; postcode: string },
  feePercent: number = PLATFORM_FEE_PERCENT
): Promise<string | null> {
  const baseUrl = getStripeCheckoutAppUrl();
  const stripe = await getStripeServer();
  const agreedCents = job.agreed_amount_cents;
  const feeCents = Math.round((agreedCents * feePercent) / 100);
  const totalCents = agreedCents + feeCents;
  const jobIdStr = String(job.id);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: agreedCents,
          product_data: {
            name: listing.title,
            description: `Job payment (to cleaner): ${listing.suburb} ${listing.postcode}. Held in escrow until you approve release.`,
          },
        },
      },
      ...(feeCents > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "aud",
                unit_amount: feeCents,
                product_data: {
                  name: "Platform fee",
                  description: `${feePercent}% service fee`,
                },
              },
            },
          ]
        : []),
    ],
    success_url: `${baseUrl}/jobs/${jobIdStr}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/jobs/${jobIdStr}?payment=canceled`,
    client_reference_id: jobIdStr,
    metadata: {
      job_id: jobIdStr,
      type: "job_payment",
    },
    payment_intent_data: {
      capture_method: "manual",
      metadata: { job_id: jobIdStr },
    },
  });
  return session.url ?? null;
}

/**
 * Additional escrow hold for an in-progress job (separate PaymentIntent from initial Pay & Start).
 * `topUpAgreedCents` is the extra job amount to the cleaner (platform fee added as second line item).
 */
export async function createJobTopUpCheckoutSessionUrl(
  job: { id: number | string },
  listing: { title: string; suburb: string; postcode: string },
  topUpAgreedCents: number,
  feePercent: number,
  noteForMetadata: string | null,
  options?: { listingTitleSuffix?: string }
): Promise<string | null> {
  const baseUrl = getStripeCheckoutAppUrl();
  const stripe = await getStripeServer();
  const agreedCents = Math.max(1, Math.floor(topUpAgreedCents));
  const feeCents = Math.round((agreedCents * feePercent) / 100);
  const totalCents = agreedCents + feeCents;
  const jobIdStr = String(job.id);
  const note = (noteForMetadata ?? "").trim().slice(0, 450);
  const suffix = options?.listingTitleSuffix?.trim() ? ` — ${options.listingTitleSuffix.trim()}` : "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: agreedCents,
          product_data: {
            name: `${listing.title}${suffix}`,
            description: `Extra job payment (held in escrow): ${listing.suburb} ${listing.postcode}. Separate charge from your original job payment.`,
          },
        },
      },
      ...(feeCents > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "aud",
                unit_amount: feeCents,
                product_data: {
                  name: "Platform fee (top-up)",
                  description: `${feePercent}% on this top-up`,
                },
              },
            },
          ]
        : []),
    ],
    success_url: `${baseUrl}/jobs/${jobIdStr}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/jobs/${jobIdStr}?payment=canceled`,
    client_reference_id: jobIdStr,
    metadata: {
      job_id: jobIdStr,
      type: "job_top_up",
      top_up_agreed_cents: String(agreedCents),
      ...(note ? { top_up_note: note } : {}),
    },
    payment_intent_data: {
      capture_method: "manual",
      metadata: {
        job_id: jobIdStr,
        type: "job_top_up",
        top_up_agreed_cents: String(agreedCents),
        ...(note ? { top_up_note: note } : {}),
      },
    },
  });
  return session.url ?? null;
}

export type CreateSetupIntentCheckoutSessionOptions = {
  /** Return URLs point at /stripe/lister-setup-return for postMessage + window.close from popup. */
  popupReturn?: boolean;
};

/**
 * Create Stripe Checkout Session in mode=setup for lister to save a card (Setup Intent).
 * On success, webhook saves setup_intent.payment_method and session.customer to profile.
 */
export async function createSetupIntentCheckoutSessionUrl(
  userId: string,
  options?: CreateSetupIntentCheckoutSessionOptions
): Promise<string | null> {
  const baseUrl = getStripeCheckoutAppUrl();
  const stripe = await getStripeServer();
  const popup = options?.popupReturn === true;
  const success_url = popup
    ? `${baseUrl}/stripe/lister-setup-return?session_id={CHECKOUT_SESSION_ID}`
    : `${baseUrl}/profile?payments=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = popup
    ? `${baseUrl}/stripe/lister-setup-return?cancelled=1`
    : `${baseUrl}/profile?payments=cancelled`;
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    payment_method_types: ["card"],
    success_url,
    cancel_url,
    metadata: {
      setup_for_lister: userId,
      type: "setup_payment_method",
    },
  });
  return session.url ?? null;
}

/**
 * Create and confirm a PaymentIntent with the lister's saved payment method (hold in escrow).
 * Uses capture_method=manual. Caller must then save payment_intent_id to the job.
 */
export async function createJobPaymentIntentWithSavedMethod(
  jobId: number | string,
  agreedAmountCents: number,
  feePercent: number,
  paymentMethodId: string,
  customerId: string | null,
  listing: { title?: string; suburb?: string; postcode?: string }
): Promise<{ paymentIntentId: string } | { error: string }> {
  const stripe = await getStripeServer();
  const feeCents = Math.round((agreedAmountCents * feePercent) / 100);
  const totalCents = agreedAmountCents + feeCents;
  const jobIdStr = String(jobId);

  try {
    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "aud",
      capture_method: "manual",
      payment_method: paymentMethodId,
      customer: customerId ?? undefined,
      metadata: { job_id: jobIdStr },
      description: listing.title
        ? `Bond clean: ${listing.suburb ?? ""} ${listing.postcode ?? ""}`
        : undefined,
    });
    const confirmed = await stripe.paymentIntents.confirm(pi.id);
    if (confirmed.status !== "requires_capture") {
      return { error: `Unexpected status after confirm: ${confirmed.status}` };
    }
    return { paymentIntentId: confirmed.id };
  } catch (e) {
    const err = e as Error;
    return { error: err.message ?? "Failed to create payment." };
  }
}

/**
 * Stub: when a bid wins (auction ends, lowest bid ≤ reserve), create a PaymentIntent
 * to hold the lister's payment. Later: use Stripe Connect so funds go to connected
 * cleaner account with platform fee (PLATFORM_FEE_PERCENT) retained; or hold in
 * platform account and transfer to cleaner on job completion.
 */
export async function createPaymentIntentHoldForBidWin(
  _listingId: string,
  _amountCents: number,
  _cleanerId: string,
  _listerId: string
): Promise<{ paymentIntentId: string | null; error?: string }> {
  // TODO: Create PaymentIntent with amount_cents, capture_method: 'manual' for hold.
  // Application fee = amountCents * PLATFORM_FEE_PERCENT / 100 when using Connect.
  // For now return stub; implement when auction-end cron sets winner.
  return { paymentIntentId: null };
}
