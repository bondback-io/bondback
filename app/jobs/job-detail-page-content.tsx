import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Briefcase } from "lucide-react";
import { getCachedGlobalSettingsForPages } from "@/lib/cached-global-settings-read";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import { ensureJobChecklistIfEmpty } from "@/lib/actions/jobs";
import {
  JobDetail,
  type JobDetailMySubmittedReview,
} from "@/components/features/job-detail";
import type { BidWithBidder } from "@/components/features/bid-history-table";
import { enrichBidsWithBidderProfiles } from "@/lib/bids/enrich-bids-with-bidders";
import { ScrollToDispute } from "@/components/features/scroll-to-dispute";
import { RecordJobView } from "@/components/features/record-job-view";
import { JobPaymentReturnAck } from "@/components/features/job-payment-return-ack";
import { OfflineJobsPrimer } from "@/components/offline/offline-jobs-primer";
import { buildJobPostingJsonLd } from "@/lib/seo/jobs-listings-seo";
import { getSiteUrl } from "@/lib/site";
import { BID_FULL_SELECT } from "@/lib/supabase/queries";
import {
  loadJobByNumericIdForSession,
  loadJobForListingDetailPage,
  loadListingFullForSession,
} from "@/lib/jobs/load-job-for-detail-route";
import { profileFieldIsAdmin } from "@/lib/is-admin";
import { isListerJobPipelineActive } from "@/lib/my-listings/lister-listing-helpers";
import { parseJobTopUpPayments } from "@/lib/job-top-up";
import {
  buildMessengerProfileMap,
  getMessengerProfile,
  messengerPeerDisplayName,
} from "@/lib/chat-messenger-display";
import { fetchMessengerPeerProfilesByIds } from "@/lib/messenger-peer-profiles-server";

export type JobDetailRouteMode = "jobs" | "listings";

export interface JobDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

function firstSearchParam(
  v: string | string[] | undefined
): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function sameUserId(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

function isStripePaymentSuccessReturn(
  sp: Record<string, string | string[] | undefined>
): boolean {
  if (firstSearchParam(sp.payment) === "success") return true;
  if (sp["payment-success"] !== undefined) return true;
  return false;
}

export async function JobDetailPageContent({
  params,
  searchParams,
  mode,
}: JobDetailPageProps & { mode: JobDetailRouteMode }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const sp = searchParams ? await searchParams : {};
  const paymentParam = firstSearchParam(sp.payment);
  const checkoutSessionId = firstSearchParam(sp.session_id);
  const paymentNotice = firstSearchParam(sp.payment_notice);
  const paymentSuccessReturn = isStripePaymentSuccessReturn(sp);

  const raw = String(id).trim();
  const isNumericJobId = /^\d+$/.test(raw);

  if (mode === "jobs" && !isNumericJobId) {
    notFound();
  }
  if (mode === "listings" && isNumericJobId) {
    notFound();
  }

  const paymentRedirectBase =
    mode === "jobs" && isNumericJobId
      ? `/jobs/${encodeURIComponent(raw)}`
      : `/listings/${encodeURIComponent(raw)}`;

  if (paymentSuccessReturn && checkoutSessionId?.startsWith("cs_")) {
    const qs = new URLSearchParams({
      session_id: checkoutSessionId,
      next: paymentRedirectBase,
    });
    redirect(`/api/stripe/checkout/return?${qs.toString()}`);
  }

  if (paymentParam === "canceled") {
    redirect(`${paymentRedirectBase}?payment_notice=canceled`);
  }

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionUserId = user?.id;

  let profile: Pick<ProfileRow, "roles" | "active_role" | "is_admin"> | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("roles, active_role, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    profile = data as Pick<ProfileRow, "roles" | "active_role" | "is_admin"> | null;
  }

  const sessionIsAdmin = profileFieldIsAdmin(profile?.is_admin);
  const detailLoadOpts = { isAdmin: sessionIsAdmin };

  const roles = (profile?.roles as string[] | null) ?? [];
  const activeRole =
    (profile?.active_role as string | null) ?? (roles[0] ?? null);
  const isCleaner = roles.includes("cleaner") && activeRole === "cleaner";
  const isListerActive = roles.includes("lister") && activeRole === "lister";

  let job: JobRow | null = null;
  let listingId: string;

  if (isNumericJobId) {
    const numericPk = parseInt(raw, 10);
    const jobRow = await loadJobByNumericIdForSession(
      supabase,
      numericPk,
      sessionUserId,
      detailLoadOpts
    );

    if (!jobRow) {
      notFound();
    }
    job = jobRow as JobRow;
    listingId = String(job.listing_id);
  } else {
    listingId = raw;
    job = await loadJobForListingDetailPage(supabase, listingId, sessionUserId, detailLoadOpts);
  }

  const listingLoaded = await loadListingFullForSession(
    supabase,
    listingId,
    sessionUserId,
    job,
    detailLoadOpts
  );

  if (!listingLoaded) {
    notFound();
  }

  const listingRow = listingLoaded as ListingRow;

  const { data: bids } = await supabase
    .from("bids")
    .select(BID_FULL_SELECT)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  const initialBids: BidWithBidder[] = await enrichBidsWithBidderProfiles(bids ?? []);

  const settings = await getCachedGlobalSettingsForPages();
  const stripeTestMode =
    (settings as { stripe_test_mode?: boolean } | null)?.stripe_test_mode ===
    true;
  const autoReleaseHours = (settings?.auto_release_hours ?? 48) as number;
  const feePercentage = resolvePlatformFeePercent(
    listingRow.platform_fee_percentage,
    settings
  );

  const jobId = job?.id ?? null;
  const jobAgreed = (job as { agreed_amount_cents?: number | null })
    ?.agreed_amount_cents;
  const listingBuyNow = listingRow.buy_now_cents;
  const listingReserve = listingRow.reserve_cents;
  const agreedAmountCents = job
    ? jobAgreed != null && jobAgreed > 0
      ? jobAgreed
      : listingBuyNow ?? listingReserve ?? 0
    : 0;
  const topUpPayments = parseJobTopUpPayments(
    (job as JobRow | null)?.top_up_payments ?? null
  );
  const proposedRefundAmount =
    (job as { proposed_refund_amount?: number | null })
      ?.proposed_refund_amount ?? null;
  const counterProposalAmount =
    (job as { counter_proposal_amount?: number | null })
      ?.counter_proposal_amount ?? null;

  const j = job as {
    payment_intent_id?: string | null;
    payment_released_at?: string | null;
    auto_release_at?: string | null;
    completed_at?: string | null;
    dispute_resolution?: string | null;
    resolution_at?: string | null;
    refund_amount?: number | null;
  };
  const hasPaymentHold = !!String(j?.payment_intent_id ?? "").trim();
  const canLeaveReview =
    Boolean(job?.status === "completed") && Boolean(j?.payment_released_at);
  const paymentTimeline =
    job && (j?.payment_intent_id || j?.payment_released_at || j?.dispute_resolution)
      ? {
          hasPaymentHold,
          heldAmountCents: hasPaymentHold ? agreedAmountCents : null,
          paymentReleasedAt: j.payment_released_at ?? null,
          disputeResolution: j.dispute_resolution ?? null,
          resolutionAt: j.resolution_at ?? null,
          refundAmountCents:
            j.refund_amount ??
            proposedRefundAmount ??
            counterProposalAmount ??
            null,
        }
      : null;

  const isJobCancelled = job?.status === "cancelled";
  const hasActiveJob = !!job && !isJobCancelled;

  if (
    job &&
    (job.status === "in_progress" ||
      job.status === "completed_pending_approval") &&
    job.id != null
  ) {
    try {
      await ensureJobChecklistIfEmpty(job.id);
    } catch (e) {
      console.error(
        "[job-detail] ensureJobChecklistIfEmpty failed (non-fatal)",
        e
      );
    }
  }

  let listerName: string | null = null;
  let cleanerName: string | null = null;
  let listerAvatarUrl: string | null = null;
  let cleanerAvatarUrl: string | null = null;
  let listerVerificationBadges: string[] | null = null;
  let cleanerVerificationBadges: string[] | null = null;

  if (job && (job.lister_id || job.winner_id)) {
    const peerRows = await fetchMessengerPeerProfilesByIds([
      job.lister_id as string | null,
      job.winner_id as string | null,
    ]);
    const peerMap = buildMessengerProfileMap(peerRows as ProfileRow[]);
    const listerProfile = getMessengerProfile(peerMap, job.lister_id as string | null);
    const cleanerProfile = getMessengerProfile(peerMap, job.winner_id as string | null);
    listerName = messengerPeerDisplayName(listerProfile, "Owner");
    cleanerName = messengerPeerDisplayName(cleanerProfile, "Cleaner");
    listerAvatarUrl = listerProfile?.profile_photo_url ?? null;
    cleanerAvatarUrl = cleanerProfile?.profile_photo_url ?? null;
    listerVerificationBadges = Array.isArray(listerProfile?.verification_badges)
      ? listerProfile.verification_badges
      : null;
    cleanerVerificationBadges = Array.isArray(cleanerProfile?.verification_badges)
      ? cleanerProfile.verification_badges
      : null;
  }

  const backLabel = isListerActive
    ? "Back to listings"
    : isCleaner
      ? "Back to my jobs"
      : "Back to jobs";
  const backHref = isListerActive ? "/my-listings" : isCleaner ? "/dashboard" : "/jobs";

  const isDisputed = job?.status === "disputed" || job?.status === "in_review";
  const disputeStatusLabel =
    job?.status === "in_review" ? "Under Review" : "Awaiting Response";

  let hasReviewedCleaner = false;
  let hasReviewedLister = false;
  let myReviewOfCleaner: JobDetailMySubmittedReview | null = null;
  let myReviewOfLister: JobDetailMySubmittedReview | null = null;
  if (user && job?.id && canLeaveReview) {
    const { data: myReviews } = await supabase
      .from("reviews")
      .select("reviewee_type, overall_rating, review_text")
      .eq("job_id", job.id)
      .eq("reviewer_id", user.id);
    for (const r of myReviews ?? []) {
      const row = r as {
        reviewee_type: string | null;
        overall_rating: number;
        review_text: string | null;
      };
      const t = String(row.reviewee_type ?? "");
      if (t === "cleaner") {
        hasReviewedCleaner = true;
        myReviewOfCleaner = {
          overall_rating: row.overall_rating,
          review_text: row.review_text,
        };
      }
      if (t === "lister") {
        hasReviewedLister = true;
        myReviewOfLister = {
          overall_rating: row.overall_rating,
          review_text: row.review_text,
        };
      }
    }
  }

  const canonicalJobUrl =
    job?.id != null
      ? `${getSiteUrl().origin}/jobs/${job.id}`
      : `${getSiteUrl().origin}/listings/${listingId}`;

  let jsonLd: Record<string, unknown>;
  try {
    jsonLd = buildJobPostingJsonLd({
      listing: listingRow,
      job,
      canonicalJobUrl,
    });
  } catch (e) {
    console.error("[job-detail] buildJobPostingJsonLd failed (non-fatal)", e);
    jsonLd = {};
  }

  const jobSnapshotForBanner = job
    ? {
        jobId: job.id,
        winnerId: job.winner_id,
        winnerName: "",
        status: job.status,
      }
    : null;
  const hasAssignedCleaner = Boolean(
    job && String(job.winner_id ?? "").trim() !== ""
  );
  const pipelineActive =
    mode === "jobs" &&
    hasAssignedCleaner &&
    jobSnapshotForBanner != null &&
    isListerJobPipelineActive(jobSnapshotForBanner);
  const jobStatusNorm = String(job?.status ?? "");
  const completedJobBanner =
    mode === "jobs" && hasAssignedCleaner && jobStatusNorm === "completed";
  const cancelledJobBanner =
    mode === "jobs" && hasAssignedCleaner && jobStatusNorm === "cancelled";

  const rawDisputeOpener = (job as { dispute_opened_by?: string | null })
    ?.dispute_opened_by;
  const disputeOpenedByTyped: "lister" | "cleaner" | null =
    rawDisputeOpener === "lister" || rawDisputeOpener === "cleaner"
      ? rawDisputeOpener
      : null;

  return (
    <OfflineJobsPrimer jobId={jobId ? String(jobId) : id}>
      <section className="page-inner space-y-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ScrollToDispute />
        <JobPaymentReturnAck
          notice={
            paymentNotice === "success" ||
            paymentNotice === "top_up_success" ||
            paymentNotice === "error" ||
            paymentNotice === "canceled"
              ? paymentNotice
              : null
          }
          agreedAmountCents={agreedAmountCents}
          feePercentage={feePercentage}
          isStripeTestMode={stripeTestMode}
        />
        {user && jobId && <RecordJobView jobId={jobId} />}
        {pipelineActive ? (
          <Alert className="border-primary/40 bg-primary/5">
            <Briefcase className="h-4 w-4" aria-hidden />
            <AlertDescription className="ml-1">
              <span className="font-semibold text-foreground">This is an active job</span>
              {cleanerName ? (
                <>
                  {" "}
                  — assigned cleaner:{" "}
                  <span className="font-medium">{cleanerName}</span>
                </>
              ) : (
                " — cleaner assigned."
              )}
            </AlertDescription>
          </Alert>
        ) : completedJobBanner ? (
          <Alert className="border-emerald-500/30 bg-emerald-500/[0.06] dark:border-emerald-800/50 dark:bg-emerald-950/25">
            <Briefcase className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <AlertDescription className="ml-1 text-emerald-950 dark:text-emerald-100">
              <span className="font-semibold text-foreground dark:text-emerald-50">
                This job is completed
              </span>
              {cleanerName ? (
                <>
                  {" "}
                  — cleaner: <span className="font-medium">{cleanerName}</span>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : cancelledJobBanner ? (
          <Alert className="border-border bg-muted/40 dark:border-gray-700 dark:bg-gray-900/40">
            <Briefcase className="h-4 w-4" aria-hidden />
            <AlertDescription className="ml-1">
              <span className="font-semibold text-foreground">This job is no longer active</span>
              <span className="text-muted-foreground"> — it was cancelled.</span>
            </AlertDescription>
          </Alert>
        ) : null}
        <Button variant="ghost" asChild className="dark:hover:bg-gray-800 dark:hover:text-gray-100">
          <Link href={backHref}>← {backLabel}</Link>
        </Button>
        {isDisputed && (
          <Alert variant="warning" className="border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h5 className="mb-1 font-medium leading-none tracking-tight text-amber-900 dark:text-amber-100">
              Dispute in progress — details below
            </h5>
            <AlertDescription className="mt-1 text-amber-800 dark:text-amber-200">
              Status: {disputeStatusLabel}
            </AlertDescription>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/50"
              >
                <a href="#dispute">View Dispute Details</a>
              </Button>
            </div>
          </Alert>
        )}
        <JobDetail
          listingId={listingId}
          initialListing={listingRow}
          initialBids={initialBids}
          isCleaner={!!isCleaner}
          hasActiveJob={hasActiveJob}
          jobId={jobId ? String(jobId) : null}
          jobStatus={job?.status ?? null}
          jobAcceptedAt={
            job && job.status !== "cancelled" ? ((job as { created_at?: string }).created_at ?? null) : null
          }
          completedAt={job ? ((job as { completed_at?: string }).completed_at ?? null) : null}
          autoReleaseAt={job ? ((job as { auto_release_at?: string }).auto_release_at ?? null) : null}
          autoReleaseHours={autoReleaseHours}
          listerName={listerName}
          cleanerName={cleanerName}
          listerVerificationBadges={listerVerificationBadges}
          cleanerVerificationBadges={cleanerVerificationBadges}
          cleanerConfirmedComplete={
            !!job && (job as { cleaner_confirmed_complete?: boolean }).cleaner_confirmed_complete === true
          }
          cleanerConfirmedAt={
            !!job
              ? ((job as { cleaner_confirmed_at?: string | null }).cleaner_confirmed_at ?? null)
              : null
          }
          reviewExtensionUsedAt={
            job ? ((job as JobRow).review_extension_used_at ?? null) : null
          }
          disputeOpenedBy={disputeOpenedByTyped}
          hasDisputeResponse={!!(job as { dispute_response_at?: string | null })?.dispute_response_at}
          agreedAmountCents={agreedAmountCents}
          proposedRefundAmount={proposedRefundAmount}
          counterProposalAmount={counterProposalAmount}
          paymentTimeline={paymentTimeline}
          hasPaymentHold={hasPaymentHold}
          isStripeTestMode={stripeTestMode}
          feePercentage={feePercentage}
          currentUserId={sessionUserId ?? null}
          isJobLister={
            !!user &&
            !!job &&
            sameUserId(user.id, job.lister_id) &&
            roles.includes("lister") &&
            isListerActive
          }
          isListingOwner={
            !!user &&
            sameUserId(listingRow.lister_id, user.id) &&
            roles.includes("lister") &&
            isListerActive
          }
          isJobCleaner={
            !!user && !!job && sameUserId(user.id, job.winner_id) && isCleaner
          }
          hasReviewedCleaner={hasReviewedCleaner}
          hasReviewedLister={hasReviewedLister}
          canLeaveReview={canLeaveReview}
          myReviewOfCleaner={myReviewOfCleaner}
          myReviewOfLister={myReviewOfLister}
          topUpPayments={topUpPayments}
        />
      </section>
    </OfflineJobsPrimer>
  );
}
