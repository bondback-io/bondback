import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeServerForMode } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/admin-activity-log";

/**
 * POST /api/stripe/webhook
 * Stripe (and Stripe Connect) events. Verify signature with STRIPE_WEBHOOK_SECRET (test)
 * or STRIPE_LIVE_WEBHOOK_SECRET (live) using raw body. Uses supabaseAdmin for all DB updates.
 * Returns 200 quickly to acknowledge receipt.
 */
export async function POST(request: Request) {
  const testSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const liveSecret = process.env.STRIPE_LIVE_WEBHOOK_SECRET;
  if (!testSecret && !liveSecret) {
    console.error("[stripe/webhook] No webhook secret set. Set STRIPE_WEBHOOK_SECRET and/or STRIPE_LIVE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[stripe/webhook] Failed to read body", e);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripeTest = testSecret ? getStripeServerForMode("test") : null;
    const stripeLive = liveSecret ? getStripeServerForMode("live") : null;
    if (stripeTest && testSecret) {
      try {
        event = stripeTest.webhooks.constructEvent(rawBody, signature, testSecret);
      } catch {
        if (stripeLive && liveSecret) {
          event = stripeLive.webhooks.constructEvent(rawBody, signature, liveSecret);
        } else {
          throw new Error("Signature verification failed");
        }
      }
    } else if (stripeLive && liveSecret) {
      event = stripeLive.webhooks.constructEvent(rawBody, signature, liveSecret);
    } else {
      throw new Error("No webhook secret available");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const logEvent = (details: Record<string, unknown>) => {
    logAdminActivity({
      adminId: null,
      actionType: "stripe_webhook",
      targetType: event.type,
      targetId: event.id,
      details: { type: event.type, livemode: event.livemode, ...details },
    });
  };

  try {
    // Cast: Stripe typings may omit rarely used Connect event names (e.g. account.application.deleted).
    switch (event.type as string) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        logEvent({ account_id: account.id, details_submitted: account.details_submitted, payouts_enabled: account.payouts_enabled });
        if (!admin) break;
        const onboardingComplete = account.details_submitted === true;
        const { error } = await admin
          .from("profiles")
          .update({ stripe_onboarding_complete: onboardingComplete } as never)
          .eq("stripe_connect_id", account.id);
        if (error) console.error("[stripe/webhook] account.updated profile update failed", error);
        break;
      }

      case "account.application.deleted":
      case "account.deleted": {
        const account = event.data.object as Stripe.Account;
        logEvent({ account_id: account.id });
        if (!admin) break;
        const { error } = await admin
          .from("profiles")
          .update({ stripe_connect_id: null, stripe_onboarding_complete: false } as never)
          .eq("stripe_connect_id", account.id);
        if (error) console.error("[stripe/webhook] account.deleted profile update failed", error);
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logEvent({
          payout_id: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          destination: payout.destination,
          arrival_date: payout.arrival_date,
        });
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const jobId = pi.metadata?.job_id ?? null;
        console.log("[stripe/webhook] payment_intent.succeeded", { payment_intent_id: pi.id, job_id: jobId });
        logEvent({ payment_intent_id: pi.id, job_id: jobId });
        // Escrow: manual-capture PIs reach `succeeded` only after capture. Do not set
        // `payment_released_at` here — `releaseJobFunds` updates DB after capture + Connect transfer.
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const jobId = pi.metadata?.job_id ?? null;
        logEvent({ payment_intent_id: pi.id, job_id: jobId, last_error: pi.last_payment_error?.message });
        if (admin && jobId) {
          const numericJobId = Number(jobId);
          const { data: job } = await admin
            .from("jobs")
            .select("id, lister_id, winner_id, listing_id")
            .eq("payment_intent_id", pi.id)
            .maybeSingle();
          const j = job as {
            lister_id: string;
            winner_id: string | null;
            listing_id?: string | null;
          } | null;
          const msg =
            "Payment for this job failed. Please check your payment method or contact support.";
          const listingUuid = j?.listing_id?.trim() ? j.listing_id : undefined;
          if (j?.lister_id || j?.winner_id) {
            const { createNotification } = await import("@/lib/actions/notifications");
            if (j.lister_id) {
              await createNotification(j.lister_id, "job_status_update", numericJobId, msg, {
                listingUuid,
              });
            }
            if (j.winner_id) {
              await createNotification(j.winner_id, "job_status_update", numericJobId, msg, {
                listingUuid,
              });
            }
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        logEvent({ charge_id: charge.id, payment_intent_id: piId, amount_refunded: charge.amount_refunded });
        if (admin && piId) {
          const { data: job } = await admin
            .from("jobs")
            .select("id")
            .eq("payment_intent_id", piId)
            .maybeSingle();
          if (job) {
            const j = job as { id: number };
            await admin
              .from("jobs")
              .update({
                refund_status: "succeeded",
                refund_amount: charge.amount_refunded ?? null,
                updated_at: new Date().toISOString(),
              } as never)
              .eq("id", j.id);
          }
        }
        break;
      }

      case "refund.created":
      case "refund.updated": {
        const refund = event.data.object as Stripe.Refund;
        const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending";
        const jobId = refund.metadata?.job_id;
        logEvent({ refund_id: refund.id, job_id: jobId, status, amount: refund.amount });
        if (admin && jobId) {
          const { error } = await admin
            .from("jobs")
            .update({
              refund_status: status,
              refund_amount: refund.amount ?? null,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("id", Number(jobId));
          if (error) console.error("[stripe/webhook] refund update job failed", jobId, error);
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const mode = session.mode ?? "payment";
        console.log("[stripe/webhook] checkout.session.completed", { session_id: session.id, mode });
        const setupForLister = session.metadata?.setup_for_lister as string | undefined;

        if (mode === "setup" && setupForLister && admin) {
          logEvent({ setup_for_lister: setupForLister });
          const stripe = getStripeServerForMode(event.livemode ? "live" : "test");
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["setup_intent"],
          });
          const setupIntent = fullSession.setup_intent as Stripe.SetupIntent | null;
          const customerId = typeof fullSession.customer === "string" ? fullSession.customer : fullSession.customer?.id ?? null;
          const paymentMethodId = setupIntent?.payment_method ?? null;
          const pmId = typeof paymentMethodId === "string" ? paymentMethodId : paymentMethodId?.id ?? null;
          if (pmId) {
            const { error } = await admin
              .from("profiles")
              .update({
                stripe_payment_method_id: pmId,
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString(),
              } as never)
              .eq("id", setupForLister);
            if (error) console.error("[stripe/webhook] checkout.session.completed setup_payment_method profile update failed", error);
          }
          break;
        }

        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        const jobIdMeta = session.metadata?.job_id;
        const listingId = session.metadata?.listing_id ?? (jobIdMeta ? null : (session.client_reference_id ?? session.metadata?.listing_id));
        logEvent({ payment_intent_id: paymentIntentId, job_id: jobIdMeta ?? undefined, listing_id: listingId ?? undefined });
        if (admin && paymentIntentId) {
          if (jobIdMeta) {
            const nowIso = new Date().toISOString();
            const numericJobId = Number(jobIdMeta);
            const { data: jobBefore } = await admin
              .from("jobs")
              .select("winner_id, lister_id, listing_id")
              .eq("id", numericJobId)
              .maybeSingle();
            const { error } = await admin
              .from("jobs")
              .update({
                payment_intent_id: paymentIntentId,
                status: "in_progress",
                updated_at: nowIso,
              } as never)
              .eq("id", numericJobId);
            if (error) console.error("[stripe/webhook] checkout.session.completed set payment_intent_id by job_id failed", jobIdMeta, error);
            else if (jobBefore) {
              const jb = jobBefore as {
                winner_id?: string | null;
                lister_id?: string | null;
                listing_id?: string | null;
              };
              const listingUuid = jb.listing_id?.trim() ? jb.listing_id : undefined;
              const { createNotification } = await import("@/lib/actions/notifications");
              if (jb.winner_id) {
                await createNotification(
                  jb.winner_id,
                  "job_approved_to_start",
                  numericJobId,
                  "Lister approved – you can start the job.",
                  { listingUuid }
                );
              }
              if (jb.lister_id) {
                await createNotification(
                  jb.lister_id,
                  "job_status_update",
                  numericJobId,
                  "Payment received — escrow is active. The cleaner has been notified to start the job.",
                  { listingUuid }
                );
              }
            }
          } else if (listingId) {
            const { error } = await admin
              .from("jobs")
              .update({ payment_intent_id: paymentIntentId, updated_at: new Date().toISOString() } as never)
              .eq("listing_id", listingId);
            if (error) console.error("[stripe/webhook] checkout.session.completed set payment_intent_id by listing_id failed", listingId, error);
          }
        }
        break;
      }

      default:
        logEvent({ unhandled: true });
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error for", event.type, event.id, err);
    logAdminActivity({
      adminId: null,
      actionType: "stripe_webhook",
      targetType: event.type,
      targetId: event.id,
      details: { type: event.type, error: err instanceof Error ? err.message : String(err) },
    });
  }

  return NextResponse.json({ received: true });
}
