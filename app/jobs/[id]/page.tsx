import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { getSiteUrl } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { getCachedGlobalSettingsForPages } from "@/lib/cached-global-settings-read";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import { ensureJobChecklistIfEmpty, fulfillStripeCheckoutReturn } from "@/lib/actions/jobs";
import { JobDetail } from "@/components/features/job-detail";
import type { BidWithBidder } from "@/components/features/job-detail";
import { ScrollToDispute } from "@/components/features/scroll-to-dispute";
import { RecordJobView } from "@/components/features/record-job-view";
import { OfflineJobsPrimer } from "@/components/offline/offline-jobs-primer";
import { buildJobListingMetadata, buildJobPostingJsonLd } from "@/lib/seo/jobs-listings-seo";
import { BID_FULL_SELECT } from "@/lib/supabase/queries";
import {
  loadJobByNumericIdForSession,
  loadJobForListingDetailPage,
  loadListingFullForSession,
} from "@/lib/jobs/load-job-for-detail-route";

export const dynamic = "force-dynamic";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

function firstSearchParam(
  v: string | string[] | undefined
): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** Compare auth/profile IDs — PostgREST may return values that are not plain strings at runtime. */
function sameUserId(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/** `?payment=success` or malformed `?payment-success` (flag-only) from some redirects */
function isStripePaymentSuccessReturn(
  sp: Record<string, string | string[] | undefined>
): boolean {
  if (firstSearchParam(sp.payment) === "success") return true;
  if (sp["payment-success"] !== undefined) return true;
  return false;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  return buildJobListingMetadata(resolvedParams.id, { canonical: "jobs" });
}

/** Next.js 15: `params` (and often `searchParams`) are Promises — await before reading. */
export interface JobDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function JobDetailPage({ params, searchParams }: JobDetailPageProps) {
  // Next.js 15 App Router: `params` is a Promise — must await (sync `params` from Pages Router does not apply).
  const resolvedParams = await params;
  const id = resolvedParams.id;
  console.log("🔍 Loading job detail for ID:", id);
  const sp = searchParams ? await searchParams : {};
  const paymentParam = firstSearchParam(sp.payment);
  const checkoutSessionId = firstSearchParam(sp.session_id);
  const paymentNotice = firstSearchParam(sp.payment_notice);
  const paymentSuccessReturn = isStripePaymentSuccessReturn(sp);

  if (paymentSuccessReturn && checkoutSessionId?.startsWith("cs_")) {
    const result = await fulfillStripeCheckoutReturn(checkoutSessionId);
    redirect(
      `/jobs/${encodeURIComponent(id)}?payment_notice=${result.ok ? "success" : "error"}`
    );
  }

  if (paymentParam === "canceled") {
    redirect(`/jobs/${encodeURIComponent(id)}?payment_notice=canceled`);
  }

  const supabase = await createServerSupabaseClient();

  /** Prefer getUser() over getSession() in RSC: validates JWT so loaders get a stable user id for admin fallbacks. */
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionUserId = user?.id;

  let profile: Pick<ProfileRow, "roles" | "active_role"> | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("roles, active_role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data as any;
  }

  const roles = (profile?.roles as string[] | null) ?? [];
  const activeRole =
    (profile?.active_role as string | null) ?? (roles[0] ?? null);
  const isCleaner = roles.includes("cleaner") && activeRole === "cleaner";
  const isListerActive = roles.includes("lister") && activeRole === "lister";

  // `/jobs/[id]`: numeric `id` is always a job PK (`jobs.id` is integer). UUID-shaped `id` is a
  // listing id — never query `listings` with a numeric string (e.g. "68") or Postgres errors / 404.
  const raw = String(id).trim();
  const isNumericJobId = /^\d+$/.test(raw);

  let job: JobRow | null = null;
  let listingId: string;

  if (isNumericJobId) {
    const numericPk = parseInt(raw, 10);
    const jobRow = await loadJobByNumericIdForSession(
      supabase,
      numericPk,
      sessionUserId
    );

    if (!jobRow) {
      console.warn("[jobs/[id]] job not loaded (numeric PK). Check RLS + SUPABASE_SERVICE_ROLE_KEY on server.", {
        numericPk,
        hasUser: !!sessionUserId,
      });
      notFound();
    }
    job = jobRow as JobRow;
    listingId = String(job.listing_id);
  } else {
    listingId = raw;
    job = await loadJobForListingDetailPage(supabase, listingId, sessionUserId);
  }

  const listingLoaded = await loadListingFullForSession(
    supabase,
    listingId,
    sessionUserId,
    job
  );

  if (!listingLoaded) {
    console.warn("[jobs/[id]] listing not loaded. Check RLS + SUPABASE_SERVICE_ROLE_KEY on server.", {
      listingId,
      hasJob: !!job,
    });
    notFound();
  }

  const listingRow = listingLoaded as ListingRow;

  const { data: bids } = await supabase
    .from("bids")
    .select(BID_FULL_SELECT)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  const initialBids: BidWithBidder[] = (bids ?? []) as BidWithBidder[];

  const settings = await getCachedGlobalSettingsForPages();
  const stripeTestMode = (settings as { stripe_test_mode?: boolean } | null)?.stripe_test_mode === true;
  const autoReleaseHours = (settings?.auto_release_hours ?? 48) as number;
  const feePercentage = resolvePlatformFeePercent(
    listingRow.platform_fee_percentage,
    settings
  );

  const jobId = job?.id ?? null;
  const jobAgreed = (job as { agreed_amount_cents?: number | null })?.agreed_amount_cents;
  const listingBuyNow = listingRow.buy_now_cents;
  const listingReserve = listingRow.reserve_cents;
  const agreedAmountCents =
    job
      ? (jobAgreed != null && jobAgreed > 0
          ? jobAgreed
          : listingBuyNow ?? listingReserve ?? 0)
      : 0;
  const proposedRefundAmount = (job as { proposed_refund_amount?: number | null })?.proposed_refund_amount ?? null;
  const counterProposalAmount = (job as { counter_proposal_amount?: number | null })?.counter_proposal_amount ?? null;

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
    await ensureJobChecklistIfEmpty(job.id);
  }

  let listerName: string | null = null;
  let cleanerName: string | null = null;
  let listerAvatarUrl: string | null = null;
  let cleanerAvatarUrl: string | null = null;
  let listerVerificationBadges: string[] | null = null;
  let cleanerVerificationBadges: string[] | null = null;

  if (job && job.lister_id) {
    const { data: listerProfile } = await supabase
      .from("profiles")
      .select("full_name, profile_photo_url, verification_badges")
      .eq("id", job.lister_id)
      .maybeSingle();
    const lp = listerProfile as {
      full_name?: string | null;
      profile_photo_url?: string | null;
      verification_badges?: string[] | null;
    } | null;
    listerName = lp?.full_name ?? null;
    listerAvatarUrl = lp?.profile_photo_url ?? null;
    listerVerificationBadges = Array.isArray(lp?.verification_badges)
      ? lp.verification_badges
      : null;
  }

  if (job && job.winner_id) {
    const { data: cleanerProfile } = await supabase
      .from("profiles")
      .select("full_name, profile_photo_url, verification_badges")
      .eq("id", job.winner_id)
      .maybeSingle();
    const cp = cleanerProfile as {
      full_name?: string | null;
      profile_photo_url?: string | null;
      verification_badges?: string[] | null;
    } | null;
    cleanerName = cp?.full_name ?? null;
    cleanerAvatarUrl = cp?.profile_photo_url ?? null;
    cleanerVerificationBadges = Array.isArray(cp?.verification_badges)
      ? cp.verification_badges
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
  if (user && job?.id && canLeaveReview) {
    const { data: myReviews } = await supabase
      .from("reviews")
      .select("reviewee_type")
      .eq("job_id", job.id)
      .eq("reviewer_id", user.id);
    const types = (myReviews ?? []).map((r: { reviewee_type: string }) => r.reviewee_type);
    hasReviewedCleaner = types.includes("cleaner");
    hasReviewedLister = types.includes("lister");
  }

  const jsonLd = buildJobPostingJsonLd({
    listing: listingRow,
    job,
    canonicalJobUrl: `${getSiteUrl().origin}/jobs/${id}`,
  });

  return (
    <OfflineJobsPrimer jobId={jobId ? String(jobId) : id}>
    <section className="page-inner space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScrollToDispute />
      {paymentNotice === "success" && (
        <Alert variant="success" className="text-sm">
          <AlertDescription>
            Payment confirmed. Funds are held in escrow and the job can proceed.
          </AlertDescription>
        </Alert>
      )}
      {paymentNotice === "error" && (
        <Alert variant="destructive" className="text-sm">
          <AlertDescription>
            We could not confirm your payment from Stripe. If a charge appears on your card, contact
            support with your checkout session details.
          </AlertDescription>
        </Alert>
      )}
      {paymentNotice === "canceled" && (
        <Alert variant="warning" className="text-sm">
          <AlertDescription>Payment was canceled. You can try again when you are ready.</AlertDescription>
        </Alert>
      )}
      {user && jobId && <RecordJobView jobId={jobId} />}
      <Button variant="ghost" asChild className="dark:hover:bg-gray-800 dark:hover:text-gray-100">
        <Link href={backHref}>← {backLabel}</Link>
      </Button>
      {isDisputed && (
        <Alert variant="warning" className="border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/40">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          {/* AlertTitle removed in newer shadcn/ui — using h5 instead */}
          <h5 className="mb-1 font-medium leading-none tracking-tight text-amber-900 dark:text-amber-100">
            Dispute in progress – details below
          </h5>
          <AlertDescription className="mt-1 text-amber-800 dark:text-amber-200">
            Status: {disputeStatusLabel}
          </AlertDescription>
          <div className="mt-3">
            <Button variant="outline" size="sm" asChild className="border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/50">
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
          job && job.status !== "cancelled" ? ((job as any).created_at ?? null) : null
        }
        completedAt={job ? ((job as any).completed_at ?? null) : null}
        autoReleaseAt={job ? ((job as any).auto_release_at ?? null) : null}
        autoReleaseHours={autoReleaseHours}
        listerName={listerName}
        cleanerName={cleanerName}
        listerVerificationBadges={listerVerificationBadges}
        cleanerVerificationBadges={cleanerVerificationBadges}
        cleanerConfirmedComplete={
          !!job && (job as any).cleaner_confirmed_complete === true
        }
        cleanerConfirmedAt={
          !!job ? ((job as any).cleaner_confirmed_at as string | null) ?? null : null
        }
        reviewExtensionUsedAt={
          job ? ((job as JobRow).review_extension_used_at ?? null) : null
        }
        disputeOpenedBy={(job as any)?.dispute_opened_by ?? null}
        hasDisputeResponse={!!(job as any)?.dispute_response_at}
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
          isListerActive
        }
        /** Same as lister-side job checks: owning the row is not enough — must be viewing as lister (hide cancel / lister tools in cleaner role). */
        isListingOwner={
          !!user &&
          sameUserId(listingRow.lister_id, user.id) &&
          isListerActive
        }
        isJobCleaner={
          !!user &&
          !!job &&
          user.id === job.winner_id &&
          isCleaner
        }
        hasReviewedCleaner={hasReviewedCleaner}
        hasReviewedLister={hasReviewedLister}
        canLeaveReview={canLeaveReview}
      />
    </section>
    </OfflineJobsPrimer>
  );
}
