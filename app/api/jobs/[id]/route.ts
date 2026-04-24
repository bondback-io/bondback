import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import {
  BID_FULL_SELECT,
  JOB_MESSAGES_FULL_SELECT,
} from "@/lib/supabase/queries";
import { enrichBidsWithBidderProfiles } from "@/lib/bids/enrich-bids-with-bidders";
import {
  loadJobByNumericIdForSession,
  loadJobForListingDetailPage,
  loadListingFullForSession,
} from "@/lib/jobs/load-job-for-detail-route";
import { profileFieldIsAdmin } from "@/lib/is-admin";
import { listerRefundCentsFromDisputeJob } from "@/lib/jobs/cleaner-net-earnings";
import { jobQualifiesForDisputeHub } from "@/lib/jobs/dispute-hub-helpers";
import { parseJobTopUpPayments } from "@/lib/job-top-up";

type Params = Promise<{ id: string }>;

/**
 * GET /api/jobs/[id]
 * Returns full job detail (listing, job, bids, messages, profile names) for offline cache.
 */
export async function GET(
  _request: Request,
  { params }: { params: Params }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const detailLoadOpts = {
    isAdmin: profileFieldIsAdmin((adminProfile as { is_admin?: unknown } | null)?.is_admin),
  };

  const raw = String(id).trim();
  const isNumericJobId = /^\d+$/.test(raw);

  let jobRow: Awaited<ReturnType<typeof loadJobByNumericIdForSession>> | null = null;

  if (isNumericJobId) {
    jobRow = await loadJobByNumericIdForSession(
      supabase,
      parseInt(raw, 10),
      user.id,
      detailLoadOpts
    );
    if (!jobRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else {
    jobRow = await loadJobForListingDetailPage(supabase, raw, user.id, detailLoadOpts);
  }

  let listingId: string = id;
  if (jobRow) {
    listingId = String((jobRow as { listing_id: string | number }).listing_id);
  }

  const listingLoaded = await loadListingFullForSession(
    supabase,
    listingId,
    user.id,
    jobRow,
    detailLoadOpts
  );

  if (!listingLoaded) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const listing = listingLoaded;

  const { data: bidsRaw } = await supabase
    .from("bids")
    .select(BID_FULL_SELECT)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  const bids = await enrichBidsWithBidderProfiles(bidsRaw ?? []);

  let jobMessages: unknown[] = [];
  if (jobRow && (jobRow as { id?: number }).id) {
    const jobId = (jobRow as { id: number }).id;
    const { data: messages } = await supabase
      .from("job_messages")
      .select(JOB_MESSAGES_FULL_SELECT)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    jobMessages = messages ?? [];
  }

  const settings = await getGlobalSettings();
  const stripeTestMode = (settings as { stripe_test_mode?: boolean } | null)?.stripe_test_mode === true;
  const feePercentage = resolvePlatformFeePercent(
    (listing as { platform_fee_percentage?: number | null }).platform_fee_percentage,
    settings,
    (listing as { service_type?: string | null }).service_type ?? null
  );

  const job = jobRow as Record<string, unknown> | null;
  const jobAgreed = job && typeof (job as { agreed_amount_cents?: number }).agreed_amount_cents === "number"
    ? (job as { agreed_amount_cents: number }).agreed_amount_cents
    : null;
  const listingObj = listing as Record<string, unknown>;
  const listingBuyNow = typeof listingObj.buy_now_cents === "number" ? listingObj.buy_now_cents : null;
  const listingReserve = typeof listingObj.reserve_cents === "number" ? listingObj.reserve_cents : null;
  const agreedAmountCents =
    job && listing
      ? (jobAgreed != null && jobAgreed > 0
          ? jobAgreed
          : listingBuyNow ?? listingReserve ?? 0)
      : 0;

  let listerName: string | null = null;
  let cleanerName: string | null = null;
  let listerAvatarUrl: string | null = null;
  let cleanerAvatarUrl: string | null = null;
  const listerId = job && typeof (job as { lister_id?: string }).lister_id === "string" ? (job as { lister_id: string }).lister_id : null;
  const winnerId = job && typeof (job as { winner_id?: string }).winner_id === "string" ? (job as { winner_id: string }).winner_id : null;

  if (listerId) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, profile_photo_url")
      .eq("id", listerId)
      .maybeSingle();
    const pr = p as { full_name?: string; profile_photo_url?: string } | null;
    listerName = pr?.full_name ?? null;
    listerAvatarUrl = pr?.profile_photo_url ?? null;
  }
  if (winnerId) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, profile_photo_url")
      .eq("id", winnerId)
      .maybeSingle();
    const pr = p as { full_name?: string; profile_photo_url?: string } | null;
    cleanerName = pr?.full_name ?? null;
    cleanerAvatarUrl = pr?.profile_photo_url ?? null;
  }

  const hasPaymentHold = !!(job && typeof (job as { payment_intent_id?: string }).payment_intent_id === "string" && (job as { payment_intent_id: string }).payment_intent_id?.trim());
  const jobStatus =
    job && typeof (job as { status?: string }).status === "string"
      ? (job as { status: string }).status
      : null;
  const proposedRefundAmount =
    job && typeof (job as { proposed_refund_amount?: number }).proposed_refund_amount === "number"
      ? (job as { proposed_refund_amount: number }).proposed_refund_amount
      : null;
  const counterProposalAmount =
    job && typeof (job as { counter_proposal_amount?: number }).counter_proposal_amount === "number"
      ? (job as { counter_proposal_amount: number }).counter_proposal_amount
      : null;
  const jRefund =
    job && typeof (job as { refund_amount?: number }).refund_amount === "number"
      ? (job as { refund_amount: number }).refund_amount
      : null;

  const listerRefundAfterSettlement =
    jobStatus === "completed" && job
      ? listerRefundCentsFromDisputeJob(job as never)
      : 0;
  const completedCleanerEscrowPayoutCents =
    jobStatus === "completed" &&
    listerRefundAfterSettlement >= 1 &&
    agreedAmountCents > 0
      ? Math.max(0, agreedAmountCents - listerRefundAfterSettlement)
      : null;
  const timelineRefundResolved =
    jobStatus === "completed" && listerRefundAfterSettlement >= 1
      ? listerRefundAfterSettlement
      : null;

  const topUpPayments = parseJobTopUpPayments(
    job ? ((job as { top_up_payments?: unknown }).top_up_payments as never) : null
  );

  const numericJobId =
    job && typeof (job as { id?: number }).id === "number"
      ? (job as { id: number }).id
      : null;
  const disputeCaseHref =
    numericJobId != null && job && jobQualifiesForDisputeHub(job as never)
      ? `/disputes/${numericJobId}`
      : null;

  const paymentTimeline = job && (hasPaymentHold || (job as { payment_released_at?: string }).payment_released_at || (job as { dispute_resolution?: string }).dispute_resolution)
    ? {
        hasPaymentHold,
        heldAmountCents: hasPaymentHold ? agreedAmountCents : null,
        paymentReleasedAt: (job as { payment_released_at?: string }).payment_released_at ?? null,
        disputeResolution: (job as { dispute_resolution?: string }).dispute_resolution ?? null,
        resolutionAt: (job as { resolution_at?: string }).resolution_at ?? null,
        refundAmountCents:
          timelineRefundResolved ??
          jRefund ??
          proposedRefundAmount ??
          counterProposalAmount ??
          null,
        topUpPayments,
        totalAgreedCents: agreedAmountCents,
        netToCleanerCents:
          completedCleanerEscrowPayoutCents ??
          (jobStatus === "completed" ? agreedAmountCents : null),
        disputeCaseHref,
      }
    : null;

  const payload = {
    listing,
    job: jobRow,
    bids: bids ?? [],
    jobMessages,
    listerName,
    cleanerName,
    listerAvatarUrl,
    cleanerAvatarUrl,
    stripeTestMode,
    feePercentage,
    agreedAmountCents,
    paymentTimeline,
    listingId,
    hasPaymentHold,
  };

  return NextResponse.json(payload);
}
